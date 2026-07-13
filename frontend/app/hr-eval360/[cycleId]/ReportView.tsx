'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Modal, useToast } from '@/components/primitives';
import { Report360View } from '@/components/eval360';
import {
  Report360Envelope, Report360Sections, Report360Status, Results360,
  generate360Report, get360Report, save360Report,
} from '@/lib/api';

const STATUS_LABEL: Record<Report360Status, string> = { DRAFT: 'Черновик', READY: 'Готов к публикации' };
const STATUS_PILL: Record<Report360Status, string> = { DRAFT: 'pill-yellow', READY: 'pill-green' };

export function ReportView({ cycleId, subjectId, res }: { cycleId: string; subjectId: string; res: Results360 }) {
  const toast = useToast();
  const [env, setEnv] = useState<Report360Envelope | null>(null);
  const [sections, setSections] = useState<Report360Sections | null>(null);
  const [status, setStatus] = useState<Report360Status>('DRAFT');
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<'generate' | 'save' | null>(null);
  const [confirmRegen, setConfirmRegen] = useState(false);

  const load = useCallback(async () => {
    try {
      const e = await get360Report(cycleId, subjectId);
      setEnv(e);
      setSections(e.report?.sections ?? null);
      setStatus(e.report?.status ?? 'DRAFT');
      setDirty(false);
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
      setDirty(false);
      toast('Черновик отчёта сгенерирован');
    } catch (err) {
      toast((err as Error).message);
      // при обрыве соединения генерация могла успеть завершиться на сервере
      load();
    } finally { setBusy(null); }
  };

  const save = async (nextStatus?: Report360Status) => {
    if (!sections) return;
    setBusy('save');
    try {
      const r = await save360Report(cycleId, subjectId, { sections, ...(nextStatus ? { status: nextStatus } : {}) });
      setStatus(r.status);
      setDirty(false);
      toast(nextStatus === 'READY' ? 'Отчёт отмечен готовым' : nextStatus === 'DRAFT' ? 'Отчёт возвращён в черновик' : 'Отчёт сохранён');
    } catch (err) { toast((err as Error).message); } finally { setBusy(null); }
  };

  if (!env) return <div className="card card-pad muted">Загрузка...</div>;

  const report = env.report;
  const controls = (
    <div className="card card-pad">
      {!env.configured && (
        <div className="small muted" style={{ marginBottom: report ? 10 : 0 }}>
          Генерация отчёта недоступна: не настроено подключение к модели ИИ
          (LLM_BASE_URL, LLM_API_KEY, LLM_MODEL). Обратитесь к администратору.
          {report ? ' Существующий отчёт можно редактировать.' : ''}
        </div>
      )}
      {!report ? (
        env.configured && (
          <div className="row-2" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" disabled={busy != null} onClick={generate}>
              {busy === 'generate' ? 'Генерация... до 1–2 минут' : 'Сгенерировать отчёт'}
            </button>
            <span className="small muted">ИИ подготовит черновик интерпретации по методике — его можно будет отредактировать.</span>
          </div>
        )
      ) : (
        <div className="stack-2">
          <div className="row-2" style={{ alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <span className={`pill ${STATUS_PILL[status]}`}>{STATUS_LABEL[status]}</span>
            <span className="small muted">
              Сгенерирован {report.generatedAt ? new Date(report.generatedAt).toLocaleString('ru-RU') : '—'}
              {report.model ? ` · ${report.model}` : ''}
            </span>
          </div>
          <div className="row-2" style={{ flexWrap: 'wrap', gap: 8 }}>
            <button className="btn btn-primary btn-sm" disabled={busy != null || !dirty} onClick={() => save()}>
              {busy === 'save' ? 'Сохранение...' : 'Сохранить'}
            </button>
            {status === 'DRAFT'
              ? <button className="btn btn-secondary btn-sm" disabled={busy != null} onClick={() => save('READY')}>Отметить готовым</button>
              : <button className="btn btn-secondary btn-sm" disabled={busy != null} onClick={() => save('DRAFT')}>Вернуть в черновик</button>}
            {env.configured && (
              <button className="btn btn-ghost btn-sm" disabled={busy != null} onClick={() => setConfirmRegen(true)}>
                {busy === 'generate' ? 'Генерация... до 1–2 минут' : 'Перегенерировать'}
              </button>
            )}
          </div>
          <div className="small muted">
            Сотрудник увидит отчёт после публикации результатов и только в статусе «Готов к публикации».
            Проверьте, что текст не раскрывает авторов оценок.
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="stack-3">
      {controls}
      <Report360View
        res={res}
        sections={sections}
        editable
        onChange={s => { setSections(s); setDirty(true); }}
      />
      {confirmRegen && (
        <Modal open onClose={() => setConfirmRegen(false)} title="Перегенерировать отчёт?"
          footer={
            <div className="row-2" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setConfirmRegen(false)}>Отмена</button>
              <button className="btn btn-primary btn-sm" onClick={generate}>Перегенерировать</button>
            </div>
          }>
          <div>Текущий черновик, включая ваши правки, будет полностью заменён новым текстом от ИИ. Продолжить?</div>
        </Modal>
      )}
    </div>
  );
}
