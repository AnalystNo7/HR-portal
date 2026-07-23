'use client';

// Выгрузка отчёта 360 в .docx (генерация в браузере, библиотека docx).
// Структура и постраничность повторяют печатную версию (print-page):
// титульный лист с картинкой → интро+шкала → сводная таблица → открытые ответы →
// общая диаграмма → сильные+развитие → слепые+скрытые → пары (диаграмма+разбор) →
// рекомендации. Диаграммы берутся из уже отрисованных SVG (данные и правки HR —
// ровно те, что на экране), скрытые крестиком блоки не выгружаются.

import {
  AlignmentType, Document, HeadingLevel, ImageRun, LevelFormat, Packer, PageBreak,
  Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, WidthType,
} from 'docx';
import type { Report360Sections, ReportExternalPair, ReportGroupPair, Results360 } from '@/lib/api';
import { SCALE, catLabel, groupByCategory, scaleBg } from './helpers';

const fmt1 = (n: number | null) => (n == null ? '—' : n.toFixed(1).replace('.', ','));

// ─── Захват диаграмм из DOM ──────────────────────────────────

/** SVG → PNG: клон с развёрнутыми CSS-переменными (fill/stroke/шрифты из computed-стилей). */
async function svgToPng(svg: SVGSVGElement): Promise<{ data: Uint8Array; width: number; height: number }> {
  const rect = svg.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const liveEls = [svg as Element, ...Array.from(svg.querySelectorAll('*'))];
  const cloneEls = [clone as Element, ...Array.from(clone.querySelectorAll('*'))];
  liveEls.forEach((live, i) => {
    const c = cloneEls[i];
    if (!c) return;
    const cs = getComputedStyle(live);
    // var(--…) не работают в отвязанном svg — фиксируем вычисленные цвета/шрифты
    if (cs.fill) c.setAttribute('fill', cs.fill);
    if (cs.stroke) c.setAttribute('stroke', cs.stroke);
    if (live.tagName === 'text' || live.tagName === 'tspan') {
      c.setAttribute('font-family', cs.fontFamily);
      if (!c.getAttribute('font-size')) c.setAttribute('font-size', cs.fontSize);
    }
  });
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(height));
  const src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(clone));
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Не удалось отрисовать диаграмму'));
    img.src = src;
  });
  const scale = 2; // ретина-качество в документе
  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;
  const cx = canvas.getContext('2d')!;
  cx.fillStyle = '#ffffff';
  cx.fillRect(0, 0, canvas.width, canvas.height);
  cx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const b64 = canvas.toDataURL('image/png').split(',')[1];
  const bin = atob(b64);
  const data = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) data[i] = bin.charCodeAt(i);
  return { data, width, height };
}

interface ChartImage { cat: string; png: { data: Uint8Array; width: number; height: number } }

/** Все радары блока диаграммы по её заголовку (data-chart-title). Нет блока (скрыт) — []. */
async function captureChart(root: HTMLElement, title: string): Promise<ChartImage[]> {
  const block = root.querySelector(`[data-chart-title="${CSS.escape(title)}"]`);
  if (!block) return [];
  const out: ChartImage[] = [];
  for (const card of Array.from(block.querySelectorAll('[data-radar-cat]'))) {
    const svg = card.querySelector('svg');
    if (!svg) continue;
    out.push({ cat: card.getAttribute('data-radar-cat') ?? '', png: await svgToPng(svg as SVGSVGElement) });
  }
  return out;
}

// ─── Кирпичи документа ───────────────────────────────────────

const pageBreak = () => new Paragraph({ children: [new PageBreak()] });

const bigTitle = (text: string, subtitle?: string): Paragraph[] => [
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 240, after: subtitle ? 60 : 240 },
    children: [new TextRun({ text, bold: true, size: 32 })],
  }),
  ...(subtitle ? [new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 240 },
    children: [new TextRun({ text: subtitle, bold: true, size: 22 })],
  })] : []),
];

const para = (children: TextRun[] | string, opts: { bullet?: boolean; spacingAfter?: number } = {}) =>
  new Paragraph({
    spacing: { after: opts.spacingAfter ?? 120 },
    ...(opts.bullet ? { numbering: { reference: 'bullets', level: 0 } } : {}),
    children: typeof children === 'string' ? [new TextRun({ text: children, size: 22 })] : children,
  });

const run = (text: string, o: { bold?: boolean; underline?: boolean } = {}) =>
  new TextRun({ text, size: 22, bold: o.bold, ...(o.underline ? { underline: {} } : {}) });

function chartParagraphs(images: ChartImage[]): Paragraph[] {
  const out: Paragraph[] = [];
  for (const im of images) {
    const maxW = 620; // ширина контентной области A4 в пикселях docx
    const w = Math.min(maxW, im.png.width);
    const h = Math.round(im.png.height * (w / im.png.width));
    out.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [new ImageRun({ type: 'png', data: im.png.data, transformation: { width: w, height: h } })],
    }));
  }
  return out;
}

function summaryTable(res: Results360): Table {
  const widths = [1100, 2538, 1200, 1200, 1200, 1200, 1200]; // сумма 9638 DXA — контентная ширина A4
  const headCell = (text: string, w: number) => new TableCell({
    width: { size: w, type: WidthType.DXA },
    shading: { type: ShadingType.CLEAR, fill: 'eef2f7' },
    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [run(text, { bold: true })] })],
  });
  const numCell = (v: number | null, w: number, bold = false) => new TableCell({
    width: { size: w, type: WidthType.DXA },
    ...(scaleBg(v) !== 'transparent' ? { shading: { type: ShadingType.CLEAR, fill: scaleBg(v).replace('#', '') } } : {}),
    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [run(fmt1(v), { bold })] })],
  });
  const rows: TableRow[] = [
    new TableRow({
      children: ['Категория', 'Ценности / компетенции', 'Самооценка', 'Руководитель', 'Коллеги', 'Подчиненные', 'Итоговая (средняя)']
        .map((t, i) => headCell(t, widths[i])),
    }),
  ];
  for (const g of groupByCategory(res.competencyResults)) {
    g.items.forEach((c, idx) => {
      rows.push(new TableRow({
        children: [
          new TableCell({
            width: { size: widths[0], type: WidthType.DXA },
            children: [new Paragraph({ children: [run(idx === 0 ? catLabel(g.cat) : '')] })],
          }),
          new TableCell({ width: { size: widths[1], type: WidthType.DXA }, children: [new Paragraph({ children: [run(c.name, { bold: true })] })] }),
          numCell(c.self, widths[2]),
          numCell(c.manager, widths[3]),
          numCell(c.peers, widths[4]),
          numCell(c.subordinates, widths[5]),
          numCell(c.total, widths[6], true),
        ],
      }));
    });
  }
  return new Table({ columnWidths: widths, width: { size: 9638, type: WidthType.DXA }, rows });
}

// ─── Разделы ─────────────────────────────────────────────────

const isHidden = (sections: Report360Sections | null, key: string) =>
  (sections?.hiddenBlocks ?? []).includes(key);

function openAnswersBlocks(res: Results360, sections: Report360Sections | null): Paragraph[] {
  const raw = {
    strengths: res.openAnswers.flatMap(g => g.items.map(i => i.strengths).filter((s): s is string => !!s)),
    toChange: res.openAnswers.flatMap(g => g.items.map(i => i.toChange).filter((s): s is string => !!s)),
    toDevelop: res.openAnswers.flatMap(g => g.items.map(i => i.toDevelop).filter((s): s is string => !!s)),
  };
  const shown = sections?.openAnswers ?? raw;
  const blocks: { key: 'strengths' | 'toChange' | 'toDevelop'; blockKey: string; title: string; subtitle: string }[] = [
    { key: 'strengths', blockKey: 'open:strengths', title: 'Сильные стороны', subtitle: 'отмеченные в открытых вопросах' },
    { key: 'toChange', blockKey: 'open:toChange', title: 'Что нужно изменить, чтобы повысить эффективность', subtitle: 'Комментарии из открытых вопросов' },
    { key: 'toDevelop', blockKey: 'open:toDevelop', title: 'Что нужно развивать в первую очередь', subtitle: 'Комментарии из открытых вопросов' },
  ];
  const out: Paragraph[] = [];
  for (const b of blocks) {
    if (isHidden(sections, b.blockKey)) continue;
    const items = shown[b.key] ?? [];
    out.push(...bigTitle(b.title, b.subtitle));
    if (!items.length) out.push(para('Нет ответов'));
    for (const t of items) out.push(para(t, { bullet: true }));
  }
  return out;
}

function narrativeSection(sections: Report360Sections, key: 'strengths' | 'developmentAreas', title: string): Paragraph[] {
  if (isHidden(sections, key)) return [];
  const items = sections[key];
  const reason = sections.emptyReasons?.[key];
  const out = [...bigTitle(title, 'по итогу совокупной оценки окружения')];
  if (!items.length) return [...out, para(reason || 'Не выявлены')];
  for (const it of items) {
    out.push(para([run(it.competency ? `${it.competency}. ` : '', { bold: true, underline: true }), run(it.text)]));
  }
  return out;
}

function zoneSection(sections: Report360Sections, key: 'blindSpots' | 'hiddenPotential', title: string): Paragraph[] {
  if (isHidden(sections, key)) return [];
  const items = sections[key];
  const reason = sections.emptyReasons?.[key];
  const out = [...bigTitle(title, 'по итогу совокупной оценки окружения')];
  if (!items.length) return [...out, para(reason || 'Не выявлены')];
  for (const it of items) {
    out.push(para([run(it.competency, { bold: true, underline: true })]));
    const parts: string[] = [];
    if (it.selfScore != null) parts.push(`Самооценка — ${fmt1(it.selfScore)}`);
    if (it.othersScore != null) parts.push(`оценка окружения — ${fmt1(it.othersScore)}`);
    let line = parts.join('; ');
    if (it.delta != null) line += `. Разница между самооценкой и оценкой окружения составляет ${Math.abs(it.delta).toFixed(1).replace('.', ',')} балла`;
    if (line) out.push(para([run('Данные оценки: ', { underline: true }), run(line + '.')]));
    if (it.text) out.push(para([run('Подтверждение из комментариев: ', { underline: true }), run(it.text)]));
    if (it.conclusion) out.push(para([run('Вывод: ', { bold: true }), run(it.conclusion)]));
  }
  return out;
}

const KIND_HEADINGS = (genitive: string): Record<string, string> => ({
  CONSENSUS: 'Зоны консенсуса (оценки близки):',
  ATTENTION: 'Зона внимания (расхождение 0,4–0,5):',
  BLIND_SPOT: `Слепые зоны (самооценка выше оценки ${genitive}):`,
  HIDDEN_POTENTIAL: `Зоны скрытого потенциала (оценка ${genitive} выше самооценки):`,
});

function pairFindings(pair: ReportGroupPair, genitive: string): Paragraph[] {
  const headings = KIND_HEADINGS(genitive);
  const out: Paragraph[] = [];
  for (const kind of ['CONSENSUS', 'ATTENTION', 'BLIND_SPOT', 'HIDDEN_POTENTIAL']) {
    const group = pair.items.filter(i => i.kind === kind);
    if (!group.length) continue;
    out.push(para([run(headings[kind], { bold: true, underline: true })]));
    for (const it of group) {
      const delta = it.delta == null ? '' : ` (расхождение ${Math.abs(it.delta).toFixed(1).replace('.', ',')} балла)`;
      out.push(para([run(`${it.competency}${delta}. `, { bold: true }), run(it.text)], { bullet: true }));
    }
  }
  return out;
}

function externalFindings(pair: ReportExternalPair, groupLabel: string): Paragraph[] {
  if (!pair.items.length) return [para('Значимых расхождений между оценками групп не выявлено')];
  const out: Paragraph[] = [];
  for (const it of pair.items) {
    const scores: string[] = [];
    if (it.managerScore != null) scores.push(`руководитель ${fmt1(it.managerScore)}`);
    if (it.groupScore != null) scores.push(`${groupLabel} ${fmt1(it.groupScore)}`);
    out.push(para([run(it.competency, { bold: true, underline: true }), run(scores.length ? ` (${scores.join(' | ')})` : '')]));
    if (it.text) out.push(para(it.text));
    if (it.actions.length) {
      out.push(para([run('Действия:', { bold: true })], { spacingAfter: 60 }));
      for (const a of it.actions) out.push(para(a, { bullet: true }));
    }
  }
  return out;
}

function recommendations(sections: Report360Sections): Paragraph[] {
  if (isHidden(sections, 'recommendations')) return [];
  const out = [...bigTitle('Рекомендации по развитию')];
  sections.recommendations.forEach((theme, i) => {
    if (!theme.title && theme.subtopics.every(s => !s.title && !s.text)) return;
    out.push(para([run(`${i + 1}. ${theme.title}`, { bold: true })]));
    for (const s of theme.subtopics) {
      if (!s.title && !s.text) continue;
      out.push(para([run(s.title ? `${s.title}: ` : '', { bold: true }), run(s.text)], { bullet: true }));
    }
  });
  return out;
}

// ─── Сборка и скачивание ─────────────────────────────────────

/**
 * Собирает и скачивает .docx отчёта. root — DOM-контейнер отрисованного отчёта
 * (для захвата диаграмм), fileBase — имя файла без расширения.
 */
export async function downloadReportDocx(
  res: Results360,
  sections: Report360Sections | null,
  root: HTMLElement,
  fileBase: string,
): Promise<void> {
  const cover = await fetch('/report-cover.jpg').then(r => (r.ok ? r.arrayBuffer() : null)).catch(() => null);

  const children: (Paragraph | Table)[] = [];

  // 1. Титульный лист: заголовок, ФИО, картинка
  children.push(
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 1200, after: 120 }, children: [new TextRun({ text: 'Результаты оценки 360', bold: true, size: 56 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 480 }, children: [new TextRun({ text: res.subject.name, bold: true, size: 36 })] }),
  );
  if (cover) {
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new ImageRun({ type: 'jpg', data: new Uint8Array(cover), transformation: { width: 600, height: 388 } })],
    }));
  }
  children.push(pageBreak());

  // 2. Вводный текст + шкала
  const intro = [
    'Результаты сводной таблицы основаны на анонимных оценках ваших коллег, руководителей и подчинённых.',
    'Данные представлены в обобщённом виде.',
    'По каждой ценности и каждому поведенческому индикатору рассчитан средний балл.',
    'Если участник выбрал ответ «не может оценить / не наблюдал ситуаций для проявления поведения», то этот вопрос не учитывался при расчёте.',
    'Цветовая индикация оценки выполнена в соответствии с приведённой шкалой.',
  ];
  for (const line of intro) children.push(para(line));
  children.push(...bigTitle('Шкала оценок'));
  for (const s of SCALE) children.push(para([run(`${s.label} — `, { bold: true }), run(s.desc)]));
  children.push(pageBreak());

  // 3. Сводная таблица
  children.push(...bigTitle('Сводная таблица оценки'), summaryTable(res));
  children.push(para(`Шкала: ${res.scalePoints.map(p => `${p.value} — ${p.label}`).join(' · ')}`, { spacingAfter: 0 }));
  children.push(pageBreak());

  // 4. Открытые ответы (одним листом)
  children.push(...openAnswersBlocks(res, sections));
  children.push(pageBreak());

  // 5. Общая диаграмма
  const overallTitle = 'Диаграмма сравнительных оценок по всем категориям респондентов';
  const overall = await captureChart(root, overallTitle);
  if (overall.length) {
    children.push(...bigTitle(overallTitle), ...chartParagraphs(overall));
    children.push(pageBreak());
  }

  if (sections) {
    // 6. Сильные стороны + зоны развития
    children.push(
      ...narrativeSection(sections, 'strengths', 'Сильные стороны'),
      ...narrativeSection(sections, 'developmentAreas', 'Зоны развития'),
      pageBreak(),
      // 7. Слепые зоны + скрытые возможности
      ...zoneSection(sections, 'blindSpots', 'Слепые зоны'),
      ...zoneSection(sections, 'hiddenPotential', 'Скрытые возможности'),
      pageBreak(),
    );

    // 8. Пары самооценки: диаграмма + разбор — каждый на своём листе
    const selfPairs: { pair: ReportGroupPair['pair']; chartTitle: string; genitive: string }[] = [
      { pair: 'SELF_MANAGER', chartTitle: 'Диаграмма сравнения самооценки и оценки руководителя', genitive: 'руководителя' },
      { pair: 'SELF_SUBORDINATE', chartTitle: 'Диаграмма сравнения самооценки и оценки подчиненных', genitive: 'подчиненных' },
      { pair: 'SELF_PEER', chartTitle: 'Диаграмма сравнения самооценки и оценки коллег', genitive: 'коллег' },
    ];
    for (const b of selfPairs) {
      const images = await captureChart(root, b.chartTitle); // пусто, если блок скрыт/группы нет
      const pair = sections.groupComparison.find(p => p.pair === b.pair);
      const showPair = pair && !isHidden(sections, `pair:${b.pair}`) && pair.items.length > 0;
      if (!images.length && !showPair) continue;
      if (images.length) children.push(...bigTitle(b.chartTitle), ...chartParagraphs(images));
      if (showPair) children.push(...pairFindings(pair, b.genitive));
      children.push(pageBreak());
    }

    // 9. Пары внешних групп
    const extPairs: { pair: ReportExternalPair['pair']; chartTitle: string; groupLabel: string }[] = [
      { pair: 'MANAGER_SUBORDINATE', chartTitle: 'Диаграмма сравнения оценок руководителя и подчиненных', groupLabel: 'подчинённые' },
      { pair: 'MANAGER_PEER', chartTitle: 'Диаграмма сравнения оценок руководителя и коллег', groupLabel: 'коллеги' },
    ];
    for (const b of extPairs) {
      const images = await captureChart(root, b.chartTitle);
      const pair = sections.externalComparison?.find(p => p.pair === b.pair);
      const showPair = !!pair && !isHidden(sections, `extpair:${b.pair}`);
      if (!images.length && !showPair) continue;
      if (images.length) children.push(...bigTitle(b.chartTitle), ...chartParagraphs(images));
      if (showPair && pair) children.push(...externalFindings(pair, b.groupLabel));
      children.push(pageBreak());
    }

    // 10. Рекомендации
    children.push(...recommendations(sections));
  }

  const doc = new Document({
    numbering: {
      config: [{
        reference: 'bullets',
        levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT }],
      }],
    },
    styles: { default: { document: { run: { font: 'Calibri', size: 22 } } } },
    sections: [{ children }],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${fileBase}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}
