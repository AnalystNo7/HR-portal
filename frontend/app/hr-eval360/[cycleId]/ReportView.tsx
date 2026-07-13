'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Modal, useToast } from '@/components/primitives';
import { Report360View, emptyReport360Sections } from '@/components/eval360';
import {
  Report360Envelope, Report360Sections, Report360Status, Results360,
  generate360Report, get360Report, save360Report,
} from '@/lib/api';

const STATUS_LABEL: Record<Report360Status, string> = { DRAFT: 'Черновик', READY: 'Готов к публикации' };
const STATUS_PILL: Record<Report360Status, string> = { DRAFT: 'pill-yellow', READY: 'pill-green' };

export function ReportView({ cycleId, subjectId, res }: { cycleId: string; subjectId: string; res: Results360 }) {
  const toast = useToast();
  const [env, setEnv] = useState<Report360Envelope | null>(null);
  // для HR разделы видны всегда: пока отчёта нет — пустой шаблон, первое «Готово» создаст отчёт
  const [sections, setSections] = useState<Report360Sections>(emptyReport360Sections());
  const [status, setStatus] = useState<Report360Status>('DRAFT');
  const [busy, setBusy] = useState<'generate' | 'save' | null>(null);
  const [confirmRegen, setConfirmRegen] = useState(false);
  const [printMode, setPrintMode] = useState(false);

  // на время печати отчёт переключается в read-only (поля ввода печатаются некрасиво)
  useEffect(() => {
    if (!printMode) return;
    const done = () => setPrintMode(false);
    window.addEventListener('afterprint', done);
    const raf = requestAnimationFrame(() => window.print());
    return () => { window.removeEventListener('afterprint', done); cancelAnimationFrame(raf); };
  }, [printMode]);

  const load = useCallback(async () => {
    try {
      const e = await get360Report(cycleId, subjectId);
      setEnv(e);
      setSections(e.report?.sections ?? emptyReport360Sections());
      setStatus(e.report?.status ?? 'DRAFT');
    } catch (err) { toast((err as Error).message); }
  }, [cycleId, subjectId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  const generate = async () => {
    setConfirmRegen(false);
    setBusy('generate');
    try {
      const r = await generate360Report(cycleId, subjectId);
      setEnv(e => (e ? { ...e, report: r } : e));
      setSections(r.sections);
      setStatus(r.status);
      toast('Черновик отчёта сгенерирован');
    } catch (err) {
      toast((err as Error).message);
      // при обрыве соединения генерация могла успеть завершиться на сервере
      load();
    } finally { setBusy(null); }
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

  if (!env) return <div className="card card-pad muted">Загрузка...</div>;

  const report = env.report;
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
            ? <button className="btn btn-secondary btn-sm" disabled={busy != null} onClick={() => setConfirmRegen(true)}>
                {busy === 'generate' ? 'Генерация... до 1–2 минут' : 'Перегенерировать'}
              </button>
            : <button className="btn btn-primary btn-sm" disabled={busy != null} onClick={generate}>
                {busy === 'generate' ? 'Генерация... до 1–2 минут' : 'Сгенерировать отчёт'}
              </button>
        )}
        {report && (status === 'DRAFT'
          ? <button className="btn btn-secondary btn-sm" disabled={busy != null} onClick={() => setReportStatus('READY')}>Отметить готовым</button>
          : <button className="btn btn-secondary btn-sm" disabled={busy != null} onClick={() => setReportStatus('DRAFT')}>Вернуть в черновик</button>)}
        <button className="btn btn-ghost btn-sm" onClick={() => setPrintMode(true)}>Скачать PDF</button>
      </div>
      <div className="small muted">
        Редактирование — по значку карандаша на блоке; «Готово» сохраняет изменения.
        Сотрудник увидит отчёт после публикации результатов и только в статусе «Готов к публикации».
        Проверьте, что текст не раскрывает авторов оценок.
      </div>
    </div>
  );

  return (
    <div className="stack-3">
      {controls}
      <Report360View
        res={res}
        sections={sections}
        editable={!printMode}
        onChange={setSections}
        onCommit={commit}
      />
      {confirmRegen && (
        <Modal open onClose={() => setConfirmRegen(false)} title="Перегенерировать отчёт?"
          footer={
            <div className="row-2" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setConfirmRegen(false)}>Отмена</button>
              <button className="btn btn-primary btn-sm" onClick={generate}>Перегенерировать</button>
            </div>
          }>
          <div>Текущее содержимое отчёта, включая ваши правки, будет полностью заменено новым текстом от ИИ. Продолжить?</div>
        </Modal>
      )}
    </div>
  );
}
