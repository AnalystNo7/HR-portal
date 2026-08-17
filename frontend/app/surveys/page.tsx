'use client';

// Раздел «Опросы». Первая вкладка — «Выгорание (MBI)»: сотрудник вносит и видит
// свои замеры, HR — сводку по всем + Excel-загрузка, руководитель — только уровни
// подчинённых (баллы и ИСП сервер руководителю не отдаёт).

import React, { useCallback, useEffect, useState } from 'react';
import { Icon, Modal, useToast } from '@/components/primitives';
import { useAuth } from '@/contexts/AuthContext';
import {
  BurnoutImportRow, BurnoutLevel, BurnoutOverviewRow, BurnoutResult, BurnoutTeamRow,
  Department, createBurnout, deleteBurnout, executeBurnoutImport, getBurnoutHistory,
  getBurnoutOverview, getBurnoutTeam, getDepartmentsList, getEmployees, getMyBurnout,
  previewBurnoutImport, updateBurnout, Employee,
} from '@/lib/api';

const TEST_URL = 'https://psytests.org/stress/maslach.html';

const SCALES = [
  { key: 'exhaustion' as const, label: 'Эмоциональное истощение', max: 54 },
  { key: 'depersonalization' as const, label: 'Деперсонализация', max: 30 },
  { key: 'reduction' as const, label: 'Редукция проф. достижений', max: 48 },
];

const LEVEL_LABEL: Record<BurnoutLevel, string> = { LOW: 'низкий', MEDIUM: 'средний', HIGH: 'высокий' };
const LEVEL_CLS: Record<BurnoutLevel, string> = { LOW: 'pill-green', MEDIUM: 'pill-yellow', HIGH: 'pill-red' };

const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('ru-RU') : '—');

function LevelPill({ level }: { level: BurnoutLevel }) {
  return <span className={`pill ${LEVEL_CLS[level]}`}>{LEVEL_LABEL[level]}</span>;
}

function ScoreCell({ value, level }: { value: number; level: BurnoutLevel }) {
  return (
    <td className="small" style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
      <b className="tabular">{value}</b> <LevelPill level={level} />
    </td>
  );
}

export default function SurveysPage() {
  const { role } = useAuth();
  const isHr = role === 'hr' || role === 'admin';
  const isManager = role === 'manager';

  return (
    <div>
      <h2 style={{ fontFamily: 'var(--font-head)', fontSize: 22, marginBottom: 4 }}>Опросы</h2>
      <div className="row-2" role="tablist" style={{ gap: 8, margin: '10px 0 16px' }}>
        <button className="btn btn-secondary btn-sm" aria-selected>Выгорание (MBI)</button>
      </div>

      <MySection />
      {isManager && <TeamSection />}
      {isHr && <HrSection />}
    </div>
  );
}

// ─── Мои замеры (все роли) ───────────────────────────────────

function MySection() {
  const [rows, setRows] = useState<BurnoutResult[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const toast = useToast();

  const load = useCallback(() => { getMyBurnout().then(setRows).catch(() => {}); }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="card card-pad" style={{ marginBottom: 16 }}>
      <div className="row-2" style={{ alignItems: 'center', marginBottom: 10 }}>
        <b>Мои замеры</b>
        <div className="flex-1" />
        <a className="btn btn-ghost btn-sm" href={TEST_URL} target="_blank" rel="noreferrer">
          <Icon name="arrow_right" size={14} /> Пройти тест
        </a>
        <button className="btn btn-primary btn-sm" onClick={() => setFormOpen(true)}>
          <Icon name="plus" size={14} /> Внести результат
        </button>
      </div>
      {rows.length === 0
        ? <div className="small muted">Замеров пока нет. Пройдите тест по ссылке и внесите результат.</div>
        : <BurnoutTable rows={rows} />}
      {formOpen && (
        <BurnoutForm
          onClose={() => setFormOpen(false)}
          onSaved={() => { setFormOpen(false); toast('Результат сохранён'); load(); }}
        />
      )}
    </div>
  );
}

function BurnoutTable({ rows, onDelete, onEdit }: {
  rows: BurnoutResult[];
  onDelete?: (r: BurnoutResult) => void;
  onEdit?: (r: BurnoutResult) => void;
}) {
  return (
    <table className="tbl">
      <thead>
        <tr>
          <th>Дата</th>
          {SCALES.map(s => <th key={s.key} style={{ textAlign: 'center' }}>{s.label}</th>)}
          <th style={{ textAlign: 'center' }}>Индекс перегорания</th>
          <th>Источник</th>
          {(onDelete || onEdit) && <th style={{ width: 90 }} />}
        </tr>
      </thead>
      <tbody>
        {rows.map(r => (
          <tr key={r.id}>
            <td className="small">{fmtDate(r.takenAt)}</td>
            <ScoreCell value={r.exhaustion} level={r.levels.exhaustion} />
            <ScoreCell value={r.depersonalization} level={r.levels.depersonalization} />
            <ScoreCell value={r.reduction} level={r.levels.reduction} />
            <td className="small tabular" style={{ textAlign: 'center', fontWeight: 700 }}>
              {r.isp.toFixed(2).replace('.', ',')}
            </td>
            <td className="small">
              {r.sourceUrl
                ? <a href={r.sourceUrl} target="_blank" rel="noreferrer" className="job-link">ссылка</a>
                : r.source === 'IMPORT' ? 'импорт' : 'вручную'}
            </td>
            {(onDelete || onEdit) && (
              <td style={{ whiteSpace: 'nowrap' }}>
                {onEdit && <button className="btn btn-ghost btn-sm" onClick={() => onEdit(r)}><Icon name="edit" size={13} /></button>}
                {onDelete && <button className="btn btn-ghost btn-sm" style={{ color: 'var(--err)' }} onClick={() => onDelete(r)}><Icon name="trash" size={13} /></button>}
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ─── Форма внесения/правки ───────────────────────────────────

function BurnoutForm({ onClose, onSaved, forEmployee, editing }: {
  onClose: () => void;
  onSaved: () => void;
  /** HR вносит за сотрудника. */
  forEmployee?: { id: string; name: string } | null;
  editing?: BurnoutResult | null;
}) {
  const [takenAt, setTakenAt] = useState(editing ? editing.takenAt.slice(0, 10) : new Date().toISOString().slice(0, 10));
  const [scores, setScores] = useState<Record<string, string>>({
    exhaustion: editing ? String(editing.exhaustion) : '',
    depersonalization: editing ? String(editing.depersonalization) : '',
    reduction: editing ? String(editing.reduction) : '',
  });
  const [sourceUrl, setSourceUrl] = useState(editing?.sourceUrl ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setError(null);
    const parsed: Record<string, number> = {};
    for (const s of SCALES) {
      const n = Number(scores[s.key]);
      if (scores[s.key] === '' || !Number.isInteger(n) || n < 0 || n > s.max) {
        setError(`${s.label}: целое число от 0 до ${s.max}`);
        return;
      }
      parsed[s.key] = n;
    }
    if (!takenAt) { setError('Укажите дату прохождения'); return; }
    setSaving(true);
    try {
      const dto = {
        takenAt,
        exhaustion: parsed.exhaustion,
        depersonalization: parsed.depersonalization,
        reduction: parsed.reduction,
        sourceUrl: sourceUrl.trim() || undefined,
        ...(forEmployee ? { employeeId: forEmployee.id } : {}),
      };
      if (editing) await updateBurnout(editing.id, dto);
      else await createBurnout(dto);
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose}
      title={editing ? 'Правка замера' : forEmployee ? `Результат теста — ${forEmployee.name}` : 'Внести результат теста'}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Отмена</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Сохранение...' : 'Сохранить'}</button>
        </>
      }>
      {error && <div className="small" style={{ marginBottom: 10, color: 'var(--err)' }}>{error}</div>}
      <div className="field"><label className="small">Дата прохождения *</label>
        <input className="inp" type="date" value={takenAt} onChange={e => setTakenAt(e.target.value)} />
      </div>
      {SCALES.map(s => (
        <div className="field" key={s.key}>
          <label className="small">{s.label} (0–{s.max}) *</label>
          <input className="inp" type="number" min={0} max={s.max} value={scores[s.key]}
            onChange={e => setScores(prev => ({ ...prev, [s.key]: e.target.value }))} />
        </div>
      ))}
      <div className="field"><label className="small">Ссылка на результат (psytests.org, необязательно)</label>
        <input className="inp" placeholder="https://psytests.org/result?v=…" value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} />
      </div>
    </Modal>
  );
}

// ─── Руководитель: уровни подчинённых ────────────────────────

function TeamSection() {
  const [rows, setRows] = useState<BurnoutTeamRow[]>([]);
  useEffect(() => { getBurnoutTeam().then(setRows).catch(() => {}); }, []);
  return (
    <div className="card card-pad" style={{ marginBottom: 16 }}>
      <b>Моя команда</b>
      <div className="small muted" style={{ margin: '4px 0 10px' }}>
        Руководителю доступны только уровни по шкалам, без баллов.
      </div>
      {rows.length === 0 ? <div className="small muted">Подчинённых нет.</div> : (
        <table className="tbl">
          <thead>
            <tr>
              <th>Сотрудник</th>
              {SCALES.map(s => <th key={s.key} style={{ textAlign: 'center' }}>{s.label}</th>)}
              <th>Дата замера</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.employeeId}>
                <td className="small"><b>{r.name}</b></td>
                {SCALES.map(s => (
                  <td key={s.key} style={{ textAlign: 'center' }}>
                    {r.levels ? <LevelPill level={r.levels[s.key]} /> : <span className="small muted">—</span>}
                  </td>
                ))}
                <td className="small">{fmtDate(r.takenAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── HR: сводка, история, внесение, Excel ────────────────────

function HrSection() {
  const [rows, setRows] = useState<BurnoutOverviewRow[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [deptId, setDeptId] = useState('');
  const [historyFor, setHistoryFor] = useState<BurnoutOverviewRow | null>(null);
  const [formFor, setFormFor] = useState<{ id: string; name: string } | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [pickOpen, setPickOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const toast = useToast();

  const load = useCallback(() => { getBurnoutOverview(deptId || undefined).then(setRows).catch(() => {}); }, [deptId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    getDepartmentsList().then(setDepartments).catch(() => {});
    getEmployees({ limit: 1000 }).then(r => setEmployees(r.data)).catch(() => {});
  }, []);

  return (
    <div className="card card-pad">
      <div className="row-2" style={{ alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
        <b>Сводка по сотрудникам</b>
        <div className="flex-1" />
        <select className="sel" style={{ width: 220, height: 30 }} value={deptId} onChange={e => setDeptId(e.target.value)}>
          <option value="">Все подразделения</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <button className="btn btn-secondary btn-sm" onClick={() => setPickOpen(true)}>
          <Icon name="plus" size={14} /> Внести за сотрудника
        </button>
        <button className="btn btn-primary btn-sm" onClick={() => setImportOpen(true)}>
          <Icon name="upload" size={14} /> Загрузить из Excel
        </button>
      </div>
      <table className="tbl">
        <thead>
          <tr>
            <th>Сотрудник</th>
            <th>Подразделение</th>
            {SCALES.map(s => <th key={s.key} style={{ textAlign: 'center' }}>{s.label}</th>)}
            <th style={{ textAlign: 'center' }}>Индекс</th>
            <th>Дата</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.employeeId} style={{ cursor: r.last ? 'pointer' : undefined }} onClick={() => r.last && setHistoryFor(r)}>
              <td className="small"><b>{r.name}</b></td>
              <td className="small">{r.department}</td>
              {r.last ? (
                <>
                  <ScoreCell value={r.last.exhaustion} level={r.last.levels.exhaustion} />
                  <ScoreCell value={r.last.depersonalization} level={r.last.levels.depersonalization} />
                  <ScoreCell value={r.last.reduction} level={r.last.levels.reduction} />
                  <td className="small tabular" style={{ textAlign: 'center', fontWeight: 700 }}>{r.last.isp.toFixed(2).replace('.', ',')}</td>
                  <td className="small">{fmtDate(r.last.takenAt)}</td>
                </>
              ) : (
                <td colSpan={5} className="small muted" style={{ textAlign: 'center' }}>замеров нет</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {historyFor && (
        <HistoryModal row={historyFor} onClose={() => setHistoryFor(null)} onChanged={load} />
      )}
      {pickOpen && (
        <Modal open onClose={() => setPickOpen(false)} title="За кого внести результат">
          <select className="sel" style={{ width: '100%' }} defaultValue="" onChange={e => {
            const emp = employees.find(x => x.id === e.target.value);
            if (emp) { setPickOpen(false); setFormFor({ id: emp.id, name: `${emp.lastName} ${emp.firstName}` }); }
          }}>
            <option value="" disabled>— Выберите сотрудника —</option>
            {employees.map(e => <option key={e.id} value={e.id}>{e.lastName} {e.firstName} {e.middleName ?? ''}</option>)}
          </select>
        </Modal>
      )}
      {formFor && (
        <BurnoutForm forEmployee={formFor} onClose={() => setFormFor(null)}
          onSaved={() => { setFormFor(null); toast('Результат сохранён'); load(); }} />
      )}
      {importOpen && (
        <ImportModal onClose={() => setImportOpen(false)} onDone={() => { setImportOpen(false); load(); }} />
      )}
    </div>
  );
}

function HistoryModal({ row, onClose, onChanged }: {
  row: BurnoutOverviewRow; onClose: () => void; onChanged: () => void;
}) {
  const [history, setHistory] = useState<BurnoutResult[]>([]);
  const [editing, setEditing] = useState<BurnoutResult | null>(null);
  const [deleting, setDeleting] = useState<BurnoutResult | null>(null);
  const toast = useToast();
  const load = useCallback(() => { getBurnoutHistory(row.employeeId).then(setHistory).catch(() => {}); }, [row.employeeId]);
  useEffect(() => { load(); }, [load]);

  return (
    <Modal open onClose={onClose} size="xl" title={`Динамика — ${row.name}`}>
      <BurnoutTable rows={history} onEdit={setEditing} onDelete={setDeleting} />
      {editing && (
        <BurnoutForm editing={editing} onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); toast('Замер обновлён'); load(); onChanged(); }} />
      )}
      {deleting && (
        <Modal open onClose={() => setDeleting(null)} title="Удалить замер?"
          footer={
            <>
              <button className="btn btn-secondary btn-sm" onClick={() => setDeleting(null)}>Отмена</button>
              <button className="btn btn-primary btn-sm" style={{ background: 'var(--err)' }} onClick={async () => {
                await deleteBurnout(deleting.id); setDeleting(null); toast('Замер удалён'); load(); onChanged();
              }}>Удалить</button>
            </>
          }>
          <p className="small">Замер от {fmtDate(deleting.takenAt)} будет удалён безвозвратно.</p>
        </Modal>
      )}
    </Modal>
  );
}

// ─── HR: Excel-загрузка (предпросмотр → подтверждение) ───────

function ImportModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<BurnoutImportRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  const preview = async (f: File) => {
    setFile(f); setError(null); setBusy(true);
    try { setRows(await previewBurnoutImport(f)); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  const run = async () => {
    if (!file) return;
    setBusy(true); setError(null);
    try {
      const res = await executeBurnoutImport(file);
      toast(`Импортировано замеров: ${res.created} из ${res.total}`);
      onDone();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  const validCount = rows?.filter(r => r.errors.length === 0).length ?? 0;

  return (
    <Modal open onClose={onClose} size="xl" title="Загрузка результатов из Excel"
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Отмена</button>
          <button className="btn btn-primary" disabled={busy || !rows || validCount === 0} onClick={run}>
            {busy ? 'Обработка...' : `Импортировать (${validCount})`}
          </button>
        </>
      }>
      <div className="small muted" style={{ marginBottom: 10 }}>
        Колонки файла: employee_number (или email), date, exhaustion, depersonalization, reduction.
        Строки с ошибками будут пропущены.
      </div>
      {error && <div className="small" style={{ marginBottom: 10, color: 'var(--err)' }}>{error}</div>}
      <input type="file" accept=".xlsx,.xls" onChange={e => { const f = e.target.files?.[0]; if (f) preview(f); }} />
      {rows && (
        <table className="tbl" style={{ marginTop: 12 }}>
          <thead>
            <tr><th>#</th><th>Сотрудник</th><th>Дата</th><th>ЭИ</th><th>ДП</th><th>РПД</th><th>Статус</th></tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.rowNum} style={r.errors.length ? { background: 'var(--gpc-red-50, #fef2f2)' } : undefined}>
                <td className="small muted">{r.rowNum}</td>
                <td className="small">{r.employeeName ?? r.personnelNumber ?? r.email}</td>
                <td className="small">{fmtDate(r.takenAt)}</td>
                <td className="small tabular">{r.exhaustion ?? '—'}</td>
                <td className="small tabular">{r.depersonalization ?? '—'}</td>
                <td className="small tabular">{r.reduction ?? '—'}</td>
                <td className="small">
                  {r.errors.length
                    ? <span style={{ color: 'var(--gpc-red-600, #dc2626)' }}>{r.errors.join('; ')}</span>
                    : <span style={{ color: 'var(--gpc-green-600, #16a34a)' }}>OK</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Modal>
  );
}
