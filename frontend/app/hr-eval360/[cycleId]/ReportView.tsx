'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, useToast } from '@/components/primitives';
import { Report360View, emptyReport360Sections, reportPdfTitle, expectedGenMs, recordGenDuration } from '@/components/eval360';
import { downloadReportDocx } from '@/components/eval360/reportDocx';
import {
  Report360Envelope, Report360Sections, Report360Status, ReportResetMode, Results360,
  generate360Report, get360Report, save360Report, reset360Report, publish360, unpublish360,
} from '@/lib/api';

const STATUS_LABEL: Record<Report360Status, string> = { DRAFT: 'Черновик', READY: 'Готов к публикации' };
const STATUS_PILL: Record<Report360Status, string> = { DRAFT: 'pill-yellow', READY: 'pill-green' };

export function ReportView({ cycleId, subjectId, res, onPublished }: {
  cycleId: string;
  subjectId: string;
  res: Results360;
  /** Вызывается после публикации/отмены — родитель перечитывает данные. */
  onPublished?: () => void;
}) {
  const toast = useToast();
  const [env, setEnv] = useState<Report360Envelope | null>(null);
  // для HR разделы видны всегда: пока отчёта нет — пустой шаблон, первое «Готово» создаст отчёт
  const [sections, setSections] = useState<Report360Sections>(emptyReport360Sections());
  const [status, setStatus] = useState<Report360Status>('DRAFT');
  const [busy, setBusy] = useState<'generate' | 'save' | 'reset' | 'publish' | 'docx' | null>(null);
  const [confirmRegen, setConfirmRegen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [printMode, setPrintMode] = useState(false);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const downloadRef = useRef<HTMLDivElement | null>(null);

  // меню «Скачать отчёт» закрывается по клику вне
  useEffect(() => {
    if (!downloadOpen) return;
    const onDown = (e: MouseEvent) => {
      if (downloadRef.current && !downloadRef.current.contains(e.target as Node)) setDownloadOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [downloadOpen]);
  // визуализация генерации: оценочный прогресс/остаток и статус «Отчёт готов»
  const [progress, setProgress] = useState<number | null>(null);
  const [remainingSec, setRemainingSec] = useState<number | null>(null);
  const [justDone, setJustDone] = useState(false);

  // на время печати отчёт переключается в read-only (поля ввода печатаются некрасиво)
  useEffect(() => {
    if (!printMode) return;
    const prevTitle = document.title;
    document.title = reportPdfTitle(res.subject.name); // имя файла PDF по умолчанию
    const done = () => setPrintMode(false);
    window.addEventListener('afterprint', done);
    const raf = requestAnimationFrame(() => window.print());
    return () => { window.removeEventListener('afterprint', done); cancelAnimationFrame(raf); document.title = prevTitle; };
  }, [printMode, res.subject.name]);

  const load = useCallback(async () => {
    try {
      const e = await get360Report(cycleId, subjectId);
      setEnv(e);
      setSections(e.report?.sections ?? emptyReport360Sections());
      setStatus(e.report?.status ?? 'DRAFT');
    } catch (err) { toast((err as Error).message); }
  }, [cycleId, subjectId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  /**
   * Ждём готовности отчёта опросом — когда HTTP-запрос генерации оборвался (частый
   * случай: прокси отдаёт 502 на долгом ответе), но бэкенд генерацию доводит до конца.
   * Возвращает готовый отчёт (generatedAt новее базового) или null по истечении времени.
   */
  const pollUntilGenerated = async (baseGeneratedAt: string | Date | null, expectedMs: number) => {
    const baseTs = baseGeneratedAt ? new Date(baseGeneratedAt).getTime() : 0;
    const deadline = Date.now() + Math.max(expectedMs * 2, 600_000); // не меньше 10 минут
    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 5_000));
      try {
        const e = await get360Report(cycleId, subjectId);
        const rep = e.report;
        if (rep?.generatedAt && new Date(rep.generatedAt).getTime() > baseTs) return rep;
      } catch { /* сеть моргнула — продолжаем опрос */ }
    }
    return null;
  };

  const generate = async () => {
    setConfirmRegen(false);
    setBusy('generate');
    setJustDone(false);
    const baseGeneratedAt = env?.report?.generatedAt ?? null;
    const start = Date.now();
    const expected = expectedGenMs();
    setProgress(1);
    setRemainingSec(Math.ceil(expected / 1000));
    const timer = setInterval(() => {
      const elapsed = Date.now() - start;
      setProgress(Math.min(95, (elapsed / expected) * 100));
      setRemainingSec(Math.max(0, Math.ceil((expected - elapsed) / 1000)));
    }, 500);
    const showReport = (r: Report360Envelope['report']) => {
      if (!r) return;
      setEnv(e => (e ? { ...e, report: r } : e));
      setSections(r.sections);
      setStatus(r.status);
      setProgress(100);
      setRemainingSec(0);
      setJustDone(true);
      setTimeout(() => setJustDone(false), 10_000); // «Отчёт готов» держится 10 с
      toast('Черновик отчёта сгенерирован');
    };
    const pollFlow = async () => {
      const r = await pollUntilGenerated(baseGeneratedAt, expected);
      if (r) { recordGenDuration(Date.now() - start); showReport(r); }
      else { toast('Генерация затянулась — обновите страницу через минуту'); await load(); }
    };
    try {
      const r = await generate360Report(cycleId, subjectId);
      recordGenDuration(Date.now() - start); // адаптивная оценка на будущее
      showReport(r);
    } catch (err) {
      const e = err as Error & { status?: number; apiError?: boolean };
      const status = e.status;
      if (status === 409) {
        // генерация уже идёт (замок сервера) — ждём готовности опросом
        await pollFlow();
      } else if (e.apiError) {
        // честная ошибка бэкенда в JSON (нет оценок окружения, отчёт в READY,
        // «модель вернула только рассуждения без JSON» и т.п.) — показываем сразу
        toast(e.message);
        await load();
      } else if (status == null || [408, 500, 502, 503, 504].includes(status)) {
        // обрыв прокси/сети (HTML/без тела) — бэкенд генерацию продолжает, ждём опросом
        await pollFlow();
      } else {
        toast(e.message);
        await load();
      }
    } finally {
      clearInterval(timer);
      setBusy(null);
      setProgress(null);
      setRemainingSec(null);
    }
  };

  /** Открытие окна сброса — с перечиткой отчёта, чтобы кнопки строились по свежим флагам. */
  const openReset = async () => {
    try {
      const e = await get360Report(cycleId, subjectId);
      setEnv(e); // только env: sections/status не трогаем, чтобы не затереть правки
      if (!e.report) { toast('Отчёт ещё не создан — откатывать нечего'); return; }
    } catch { /* не удалось перечитать — откроем по текущему состоянию */ }
    setConfirmReset(true);
  };

  // ref-замок: React батчит setState, поэтому busy не успевает задизейблить кнопку
  // между двумя мгновенными кликами — второй сброс бил по уже удалённому отчёту
  const resetInFlight = useRef(false);
  const reset = async (mode: ReportResetMode) => {
    if (resetInFlight.current) return;
    resetInFlight.current = true;
    setConfirmReset(false);
    setBusy('reset');
    try {
      await reset360Report(cycleId, subjectId, mode);
      toast(mode === 'initial' ? 'Отчёт возвращён к первоначальному состоянию' : 'Отчёт возвращён к предыдущей версии');
    } catch (err) { toast((err as Error).message); } finally {
      // перечитать состояние при ЛЮБОМ исходе: сброс мог пройти на сервере даже при
      // ошибке чтения ответа — иначе на экране останется устаревший текст
      await load();
      setBusy(null);
      resetInFlight.current = false;
    }
  };

  /** Выгрузка в .docx: собирается из текущего состояния отчёта и отрисованных диаграмм. */
  const downloadDocx = async () => {
    const rootEl = document.querySelector('.print-area') as HTMLElement | null;
    if (!rootEl) { toast('Отчёт ещё не отрисован'); return; }
    setBusy('docx');
    try {
      await downloadReportDocx(res, env?.report ? sections : null, rootEl, reportPdfTitle(res.subject.name));
    } catch (err) { toast(`Не удалось собрать DOCX: ${(err as Error).message}`); } finally { setBusy(null); }
  };

  /** Сохранение — при нажатии «Готово» на блоке (создаёт отчёт при первом сохранении). */
  const commit = async (s: Report360Sections) => {
    setBusy('save');
    try {
      const r = await save360Report(cycleId, subjectId, { sections: s });
      setEnv(e => (e ? { ...e, report: r } : e));
      setSections(r.sections);
      setStatus(r.status);
      toast('Сохранено');
    } catch (err) { toast((err as Error).message); } finally { setBusy(null); }
  };

  const setReportStatus = async (nextStatus: Report360Status) => {
    setBusy('save');
    try {
      const r = await save360Report(cycleId, subjectId, { sections, status: nextStatus });
      setEnv(e => (e ? { ...e, report: r } : e));
      setStatus(r.status);
      toast(nextStatus === 'READY' ? 'Отчёт отмечен готовым' : 'Отчёт возвращён в черновик');
    } catch (err) { toast((err as Error).message); } finally { setBusy(null); }
  };

  /** Публикация результатов сотруднику — доступна только при отчёте в статусе READY. */
  const doPublish = async () => {
    setBusy('publish');
    try { await publish360(cycleId, subjectId); toast('Результаты опубликованы сотруднику'); onPublished?.(); }
    catch (err) { toast((err as Error).message); } finally { setBusy(null); }
  };
  const doUnpublish = async () => {
    setBusy('publish');
    try { await unpublish360(cycleId, subjectId); toast('Публикация отменена'); onPublished?.(); }
    catch (err) { toast((err as Error).message); } finally { setBusy(null); }
  };

  if (!env) return <div className="card card-pad muted">Загрузка...</div>;

  const report = env.report;
  // READY = отчёт неизменяем: генерация, сброс и редактирование блоков заблокированы
  const locked = !!report && status === 'READY';
  const lockedHint = 'Отчёт готов к публикации — верните в черновик, чтобы вносить изменения';
  const genLabel = busy === 'generate' ? 'Генерация…' : justDone ? '✓ Отчёт готов' : 'AI генерация отчета';
  const genDisabled = busy != null || justDone || locked;
  const doneStyle = justDone ? { background: 'var(--ok-green-bg)', color: 'var(--ok-green)', borderColor: 'var(--ok-green)' } : undefined;
  const controls = (
    <div className="card card-pad stack-2">
      {!env.configured && (
        <div className="small muted">
          Генерация отчёта через ИИ недоступна: не настроено подключение к модели
          (LLM_BASE_URL, LLM_API_KEY, LLM_MODEL). Разделы отчёта можно заполнить вручную —
          нажмите значок карандаша на блоке.
        </div>
      )}
      <div className="row-2" style={{ alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        {report
          ? <span className={`pill ${STATUS_PILL[status]}`}>{STATUS_LABEL[status]}</span>
          : <span className="pill pill-gray">Не создан</span>}
        {report && (
          <span className="small muted">
            {report.generatedAt
              ? `Сгенерирован ${new Date(report.generatedAt).toLocaleString('ru-RU')}${report.model ? ` · ${report.model}` : ''}`
              : 'Заполняется вручную'}
          </span>
        )}
      </div>
      <div className="row-2" style={{ flexWrap: 'wrap', gap: 8 }}>
        {env.configured && (
          report
            ? <button className="btn btn-secondary btn-sm" style={doneStyle} disabled={genDisabled} title={locked ? lockedHint : undefined} onClick={() => setConfirmRegen(true)}>
                {genLabel}
              </button>
            : <button className="btn btn-primary btn-sm" style={doneStyle} disabled={genDisabled} title={locked ? lockedHint : undefined} onClick={generate}>
                {genLabel}
              </button>
        )}
        {report && (report.canResetInitial || report.canResetPrevious) && (
          <button className="btn btn-secondary btn-sm" disabled={busy != null || locked} title={locked ? lockedHint : undefined} onClick={openReset}>
            {busy === 'reset' ? 'Сброс...' : 'Сброс'}
          </button>
        )}
        {report && (status === 'DRAFT'
          ? <button className="btn btn-secondary btn-sm" disabled={busy != null} onClick={() => setReportStatus('READY')}>Отметить готовым</button>
          : <button className="btn btn-secondary btn-sm" disabled={busy != null} onClick={() => setReportStatus('DRAFT')}>Вернуть в черновик</button>)}
        {/* публикация сотруднику — только когда отчёт «Готов к публикации» */}
        {res.published
          ? <button className="btn btn-secondary btn-sm" disabled={busy != null} onClick={doUnpublish}>
              {busy === 'publish' ? '...' : 'Отменить публикацию'}
            </button>
          : <button className="btn btn-primary btn-sm"
              disabled={busy != null || !report || status !== 'READY'}
              title={!report || status !== 'READY' ? 'Сначала отметьте отчёт готовым («Отметить готовым»)' : undefined}
              onClick={doPublish}>
              {busy === 'publish' ? 'Публикация...' : 'Опубликовать сотруднику'}
            </button>}
        <div ref={downloadRef} style={{ position: 'relative' }}>
          <button className="btn btn-ghost btn-sm" disabled={busy === 'docx'}
            onClick={() => setDownloadOpen(o => !o)}>
            {busy === 'docx' ? 'Сборка...' : 'Скачать отчёт ▾'}
          </button>
          {downloadOpen && (
            <div className="card" style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, zIndex: 20, minWidth: 120, padding: 4, boxShadow: '0 4px 16px rgba(0,0,0,.12)', display: 'flex', flexDirection: 'column' }}>
              <button className="btn btn-ghost btn-sm" style={{ justifyContent: 'flex-start' }}
                onClick={() => { setDownloadOpen(false); setPrintMode(true); }}>PDF</button>
              <button className="btn btn-ghost btn-sm" style={{ justifyContent: 'flex-start' }}
                onClick={() => { setDownloadOpen(false); void downloadDocx(); }}>DOCX</button>
            </div>
          )}
        </div>
      </div>
      {busy === 'generate' && progress != null && (
        <div className="stack-2">
          <div className="small muted">
            Генерация отчёта… {remainingSec != null && remainingSec > 0 ? `осталось ~${remainingSec} с` : 'почти готово'}
          </div>
          <div style={{ height: 6, background: 'var(--gpc-gray-100)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progress}%`, background: 'var(--gpc-blue)', borderRadius: 4, transition: 'width .4s ease' }} />
          </div>
        </div>
      )}
      <div className="small muted">
        {locked
          ? 'Отчёт в статусе «Готов к публикации» — генерация, сброс и редактирование заблокированы. Нажмите «Вернуть в черновик», чтобы вносить изменения.'
          : <>Редактирование — по значку карандаша на блоке; «Готово» сохраняет изменения.
            Сотрудник увидит отчёт после публикации результатов и только в статусе «Готов к публикации».
            Проверьте, что текст не раскрывает авторов оценок.</>}
      </div>
    </div>
  );

  return (
    <div className="stack-3">
      {controls}
      <Report360View
        res={res}
        sections={sections}
        editable={!printMode && !locked}
        onChange={setSections}
        onCommit={commit}
      />
      {confirmRegen && (
        <Modal open onClose={() => setConfirmRegen(false)} title="Сгенерировать отчёт заново?"
          footer={
            <div className="row-2" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setConfirmRegen(false)}>Отмена</button>
              <button className="btn btn-primary btn-sm" onClick={generate}>AI генерация отчета</button>
            </div>
          }>
          <div>Текущее содержимое отчёта, включая ваши правки, будет полностью заменено новым текстом от ИИ. Продолжить?</div>
        </Modal>
      )}
      {confirmReset && report && (
        <Modal open onClose={() => setConfirmReset(false)} title="Сброс отчёта"
          footer={
            <div className="row-2" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setConfirmReset(false)}>Отмена</button>
            </div>
          }>
          <div className="stack-3">
            <div>Выберите, к какому состоянию вернуть отчёт. Текущий текст, включая правки после генерации, будет заменён.</div>
            <div className="row-2" style={{ gap: 8, flexWrap: 'wrap' }}>
              {report.canResetInitial && (
                <button className="btn btn-primary btn-sm" disabled={busy != null} onClick={() => reset('initial')}>
                  Сброс до первоначального состояния
                </button>
              )}
              {report.canResetPrevious && (
                <button className="btn btn-secondary btn-sm" disabled={busy != null} onClick={() => reset('previous')}>
                  Сброс до предыдущей версии
                </button>
              )}
            </div>
            <div className="small muted">
              Первоначальное состояние — до всех генераций (как оценки пришли к HR).
              Предыдущая версия — состояние перед последней генерацией.
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
