'use client';

import React, { useEffect, useState, useCallback, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Icon, Modal, useToast } from '@/components/primitives';
import {
  get360Cycle, Cycle360Detail, Cycle360Status, Cycle360SubjectSummary,
  add360Subjects, remove360Subject, activate360Cycle,
  update360Cycle, delete360Cycle, halfLabel, update360Subject,
  get360Respondents, RespondentLane, remove360Respondent, add360Respondent, EvaluatorRole,
  getEmployees, Employee,
} from '@/lib/api';
import { SubjectPanel, SubjectPanelTab } from './SubjectPanel';

const STATUS_PILL: Record<Cycle360Status, string> = { DRAFT: 'pill-gray', ACTIVE: 'pill-green', CLOSED: 'pill-blue' };
const STATUS_LABEL: Record<Cycle360Status, string> = { DRAFT: 'Черновик', ACTIVE: 'Идёт оценка', CLOSED: 'Завершён' };

const fio = (e: { lastName: string; firstName: string; middleName: string | null }) =>
  [e.lastName, e.firstName, e.middleName].filter(Boolean).join(' ');

function progressOf(s: Cycle360SubjectSummary) {
  const total = s.respondents.length;
  const done = s.respondents.filter(r => r.status === 'COMPLETED').length;
  return { done, total };
}

export default function Eval360CyclePageWrapper() {
  return (
    <Suspense fallback={<div className="card card-pad muted">Загрузка...</div>}>
      <Eval360CyclePage />
    </Suspense>
  );
}

function Eval360CyclePage() {
  const { cycleId } = useParams<{ cycleId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const [cycle, setCycle] = useState<Cycle360Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(searchParams.get('edit') === '1');
  const [panelTab, setPanelTab] = useState<SubjectPanelTab>('workflow');
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setCycle(await get360Cycle(cycleId)); } catch {} finally { setLoading(false); }
  }, [cycleId]);
  useEffect(() => { load(); }, [load]);

  // при уходе с вкладки «Воркфлоу» или снятии выбора сотрудника режим правки завершается
  useEffect(() => {
    if (editMode && (panelTab !== 'workflow' || !selected)) setEditMode(false);
  }, [editMode, panelTab, selected]);

  const activate = async () => {
    setBusy(true);
    try { await activate360Cycle(cycleId); toast('Оценка запущена'); load(); }
    catch (e) { toast((e as Error).message); } finally { setBusy(false); }
  };
  if (loading) return <div className="card card-pad muted">Загрузка...</div>;
  if (!cycle) return <div className="card card-pad muted">Запуск не найден</div>;

  const isDraft = cycle.status === 'DRAFT';
  const isActive = cycle.status === 'ACTIVE';
  // Редактор доступен: в DRAFT всегда, в ACTIVE — только в режиме редактирования.
  const showEditor = isDraft || (isActive && editMode);
  // Правка активного запуска — только на вкладке «Воркфлоу» выбранного сотрудника
  const canEditActive = isActive && selected != null && panelTab === 'workflow';

  return (
    <div>
      <button className="btn btn-ghost btn-sm" style={{ marginBottom: 12 }} onClick={() => router.push('/hr-eval360')}>
        <Icon name="chevron_left" size={14} /> К списку запусков
      </button>

      <div className="row-2" style={{ alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-head)', fontSize: 22 }}>{cycle.name}</h2>
          <div className="row-2" style={{ alignItems: 'center', marginTop: 4 }}>
            <span className={`pill ${STATUS_PILL[cycle.status]}`}>{STATUS_LABEL[cycle.status]}</span>
            {cycle.year && <span className="small muted">{cycle.year}, {halfLabel(cycle.half)}</span>}
            <span className="small muted">{cycle.subjects.length} сотрудников · {cycle.competencies.length} компетенций</span>
          </div>
        </div>
        <div className="row-2">
          {isDraft && <>
            <button className="btn btn-ghost btn-sm" onClick={() => setEditOpen(true)}><Icon name="edit" size={14} /> Редактировать</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setDelOpen(true)}><Icon name="trash" size={14} /> Удалить</button>
            <button className="btn btn-primary" disabled={busy || cycle.subjects.length === 0} onClick={activate}>Запустить оценку</button>
          </>}
          {canEditActive && !editMode && <button className="btn btn-ghost btn-sm" onClick={() => setEditMode(true)}><Icon name="edit" size={14} /> Редактировать</button>}
          {canEditActive && editMode && <>
            <button className="btn btn-ghost btn-sm" onClick={() => setEditOpen(true)}><Icon name="edit" size={14} /> Изменить название</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setDelOpen(true)}><Icon name="trash" size={14} /> Удалить</button>
            <button className="btn btn-primary btn-sm" onClick={() => setEditMode(false)}>Готово</button>
          </>}
        </div>
      </div>

      <div className="grid-2" style={{ gridTemplateColumns: 'minmax(240px, 280px) 1fr', alignItems: 'start' }}>
        {/* Список сотрудников */}
        <div className="card" style={{ padding: 0 }}>
          <div className="card-head" style={{ padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <b>Сотрудники</b>
            {showEditor && <button className="btn btn-secondary btn-sm" onClick={() => setAddOpen(true)}><Icon name="plus" size={13} /> Добавить</button>}
          </div>
          <div>
            {cycle.subjects.length === 0 && <div className="muted small" style={{ padding: 16 }}>Сотрудники не добавлены. {showEditor && 'Нажмите «Добавить».'}</div>}
            {cycle.subjects.map(s => {
              const p = progressOf(s);
              return (
                <div key={s.id}
                  onClick={() => setSelected(s.id)}
                  style={{ padding: 12, borderTop: '1px solid var(--line)', cursor: 'pointer', background: selected === s.id ? 'var(--gpc-gray-50)' : undefined }}>
                  <div className="row-2" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
                    <b style={{ fontSize: 14 }}>{fio(s.employee)}</b>
                    {s.status === 'PUBLISHED' && <span className="pill pill-green">опубликовано</span>}
                  </div>
                  <div className="small muted" style={{ marginTop: 2 }}>Оценили {p.done} из {p.total}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Детали выбранного сотрудника */}
        <div>
          {!selected && <div className="card card-pad muted">Выберите сотрудника слева, чтобы {isDraft ? 'настроить оценивающих' : 'увидеть воркфлоу и результаты'}.</div>}
          {selected && isDraft && <DraftRespondentsEditor cycleId={cycleId} subjectId={selected} managerEditsPeers={cycle.subjects.find(s => s.id === selected)?.managerEditsPeers} onChange={load} />}
          {selected && !isDraft && <>
            <SubjectPanel cycleId={cycleId} subjectId={selected} onChange={load} onTabChange={setPanelTab} />
            {isActive && editMode && <div style={{ marginTop: 16 }}><DraftRespondentsEditor cycleId={cycleId} subjectId={selected} managerEditsPeers={cycle.subjects.find(s => s.id === selected)?.managerEditsPeers} onChange={load} /></div>}
          </>}
        </div>
      </div>

      {addOpen && <AddSubjectsModal cycleId={cycleId} existing={cycle.subjects.map(s => s.employee.id)} onClose={() => setAddOpen(false)} onAdded={() => { setAddOpen(false); load(); }} />}
      {editOpen && <EditCycleModal cycle={cycle} onClose={() => setEditOpen(false)} onSaved={() => { setEditOpen(false); load(); toast('Сохранено'); }} />}

      <Modal open={delOpen} onClose={() => setDelOpen(false)} title="Удаление воркфлоу" footer={
        <><button className="btn btn-secondary" onClick={() => setDelOpen(false)}>Отмена</button>
        <button className="btn btn-primary" style={{ background: 'var(--err)' }} disabled={busy} onClick={async () => {
          setBusy(true);
          try { await delete360Cycle(cycleId); toast('Воркфлоу удалён'); router.push('/hr-eval360'); }
          catch (e) { toast((e as Error).message); setBusy(false); }
        }}>Удалить</button></>
      }>
        <p>Удалить воркфлоу <b>{cycle.name}</b>? Действие необратимо, все добавленные сотрудники и настройки оценивающих будут удалены.</p>
      </Modal>
    </div>
  );
}

// ─── Модалка: редактирование воркфлоу ──────────────────
function EditCycleModal({ cycle, onClose, onSaved }: { cycle: Cycle360Detail; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [name, setName] = useState(cycle.name);
  const [year, setYear] = useState(cycle.year ?? new Date().getFullYear());
  const [half, setHalf] = useState(cycle.half ?? 1);
  const [description, setDescription] = useState(cycle.description ?? '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) { toast('Укажите название'); return; }
    if (!year || (half !== 1 && half !== 2)) { toast('Укажите год и полугодие'); return; }
    setSaving(true);
    try { await update360Cycle(cycle.id, { name: name.trim(), description: description.trim() || null, year, half }); onSaved(); }
    catch (e) { toast((e as Error).message); } finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title="Редактирование воркфлоу" footer={
      <><button className="btn btn-secondary" onClick={onClose}>Отмена</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Сохранение...' : 'Сохранить'}</button></>
    }>
      <div className="field"><label className="small">Название</label><input className="inp" value={name} onChange={e => setName(e.target.value)} autoFocus /></div>
      <div className="row-2">
        <div className="field flex-1"><label className="small">Год</label><input className="inp" type="number" value={year} onChange={e => setYear(parseInt(e.target.value, 10) || 0)} /></div>
        <div className="field flex-1"><label className="small">Полугодие</label>
          <select className="sel" value={half} onChange={e => setHalf(parseInt(e.target.value, 10))}>
            <option value={1}>1 полугодие</option>
            <option value={2}>2 полугодие</option>
          </select>
        </div>
      </div>
      <div className="field"><label className="small">Описание (необязательно)</label><input className="inp" value={description} onChange={e => setDescription(e.target.value)} /></div>
    </Modal>
  );
}

// ─── Редактор оценивающих ─────────────────────────────
function DraftRespondentsEditor({ cycleId, subjectId, managerEditsPeers, onChange }: { cycleId: string; subjectId: string; managerEditsPeers?: boolean; onChange: () => void }) {
  const toast = useToast();
  const [lanes, setLanes] = useState<RespondentLane[]>([]);
  const [loading, setLoading] = useState(true);
  const [addFor, setAddFor] = useState<EvaluatorRole | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setLanes(await get360Respondents(cycleId, subjectId)); } catch {} finally { setLoading(false); }
  }, [cycleId, subjectId]);
  useEffect(() => { load(); }, [load]);

  const removeR = async (rid: string) => { await remove360Respondent(cycleId, rid); load(); };
  const toggleManagerEdits = async (checked: boolean) => {
    await update360Subject(cycleId, subjectId, { managerEditsPeers: checked });
    onChange();
  };

  if (loading) return <div className="card card-pad muted">Загрузка...</div>;

  return (
    <div className="card card-pad">
      <div className="card-head"><b>Оценивающие</b><span className="small muted" style={{ marginLeft: 8 }}>авто-подбор из оргструктуры, можно скорректировать</span></div>
      <div className="wf-lanes" style={{ marginTop: 12 }}>
        {lanes.map(lane => (
          <div key={lane.role} className="wf-lane">
            <div className="wf-lane-head">
              <b>{lane.label}</b><span className="small muted">{lane.respondents.length}</span>
              {lane.role === 'PEER' && managerEditsPeers !== undefined && (
                <label className="row-2 small" style={{ alignItems: 'center', cursor: 'pointer', marginLeft: 'auto', fontWeight: 'normal' }}>
                  <input type="checkbox" checked={managerEditsPeers} onChange={e => toggleManagerEdits(e.target.checked)} />
                  Рук. редактирует
                </label>
              )}
            </div>
            {lane.respondents.map(r => (
              <div key={r.id} className="wf-person">
                <span>{r.name}</span>
                {lane.role !== 'SELF' && <button className="btn btn-ghost btn-sm" onClick={() => removeR(r.id)}><Icon name="close" size={12} /></button>}
              </div>
            ))}
            {lane.respondents.length === 0 && <div className="small muted">—</div>}
            {lane.role !== 'SELF' && <button className="btn btn-ghost btn-sm" style={{ marginTop: 6 }} onClick={() => setAddFor(lane.role)}><Icon name="plus" size={12} /> Добавить</button>}
          </div>
        ))}
      </div>
      {addFor && <AddRespondentModal cycleId={cycleId} subjectId={subjectId} role={addFor}
        existing={lanes.flatMap(l => l.respondents.map(r => r.evaluator.id))}
        onClose={() => setAddFor(null)} onAdded={() => { setAddFor(null); load(); onChange(); toast('Оценивающий добавлен'); }} />}
    </div>
  );
}

// ─── Модалка: добавить сотрудников (субъектов) ─────────
function AddSubjectsModal({ cycleId, existing, onClose, onAdded }: { cycleId: string; existing: string[]; onClose: () => void; onAdded: () => void }) {
  const [all, setAll] = useState<Employee[]>([]);
  const [search, setSearch] = useState('');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => { getEmployees({ limit: 500 }).then(r => setAll(r.data)).catch(() => {}); }, []);

  const list = all.filter(e => !existing.includes(e.id) && (!search || fio(e).toLowerCase().includes(search.toLowerCase())));

  // группировка по подразделению
  const groups: { deptId: string; dept: string; items: Employee[] }[] = [];
  for (const e of list) {
    const deptId = e.departmentId || '—';
    let g = groups.find(x => x.deptId === deptId);
    if (!g) { g = { deptId, dept: e.department?.name || 'Без подразделения', items: [] }; groups.push(g); }
    g.items.push(e);
  }

  const toggle = (id: string) => setSel(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleGroup = (items: Employee[], on: boolean) => setSel(p => {
    const n = new Set(p);
    for (const e of items) on ? n.add(e.id) : n.delete(e.id);
    return n;
  });

  const save = async () => {
    if (sel.size === 0) return;
    setSaving(true);
    try { await add360Subjects(cycleId, Array.from(sel)); onAdded(); } finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title="Добавить сотрудников в оценку" footer={
      <><button className="btn btn-secondary" onClick={onClose}>Отмена</button><button className="btn btn-primary" onClick={save} disabled={saving || sel.size === 0}>{saving ? 'Добавление...' : `Добавить (${sel.size})`}</button></>
    }>
      <div className="field"><input className="inp" placeholder="Поиск по ФИО..." value={search} onChange={e => setSearch(e.target.value)} autoFocus /></div>
      <div className="stack-3" style={{ maxHeight: 360, overflowY: 'auto' }}>
        {groups.map(g => {
          const selectedCount = g.items.filter(e => sel.has(e.id)).length;
          const allSel = selectedCount === g.items.length;
          const someSel = selectedCount > 0 && !allSel;
          return (
            <div key={g.deptId} className="stack-2">
              <label className="row-2" style={{ alignItems: 'center', cursor: 'pointer', borderBottom: '1px solid var(--line)', paddingBottom: 4 }}>
                <input type="checkbox" checked={allSel} ref={el => { if (el) el.indeterminate = someSel; }} onChange={() => toggleGroup(g.items, !allSel)} />
                <b className="small">{g.dept}</b><span className="small muted">· {g.items.length}</span>
              </label>
              {g.items.map(e => (
                <label key={e.id} className="row-2" style={{ alignItems: 'center', cursor: 'pointer', paddingLeft: 20 }}>
                  <input type="checkbox" checked={sel.has(e.id)} onChange={() => toggle(e.id)} />
                  <span>{fio(e)} <span className="small muted">· {e.position?.name}</span></span>
                </label>
              ))}
            </div>
          );
        })}
        {groups.length === 0 && <div className="small muted">Ничего не найдено</div>}
      </div>
    </Modal>
  );
}

// ─── Модалка: добавить оценивающего в дорожку ──────────
function AddRespondentModal({ cycleId, subjectId, role, existing, onClose, onAdded }: { cycleId: string; subjectId: string; role: EvaluatorRole; existing: string[]; onClose: () => void; onAdded: () => void }) {
  const [all, setAll] = useState<Employee[]>([]);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const labels: Record<EvaluatorRole, string> = { SELF: 'Самооценка', MANAGER: 'Руководитель', PEER: 'Коллеги', SUBORDINATE: 'Подчинённые' };

  useEffect(() => { getEmployees({ limit: 500 }).then(r => setAll(r.data)).catch(() => {}); }, []);
  const list = all.filter(e => !existing.includes(e.id) && (!search || fio(e).toLowerCase().includes(search.toLowerCase()))).slice(0, 50);

  const pick = async (id: string) => {
    setSaving(true);
    try { await add360Respondent(cycleId, subjectId, { evaluatorId: id, role }); onAdded(); }
    catch { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title={`Добавить в дорожку «${labels[role]}»`} footer={<button className="btn btn-secondary" onClick={onClose}>Закрыть</button>}>
      <div className="field"><input className="inp" placeholder="Поиск по ФИО..." value={search} onChange={e => setSearch(e.target.value)} autoFocus /></div>
      <div className="stack-2" style={{ maxHeight: 360, overflowY: 'auto' }}>
        {list.map(e => (
          <div key={e.id} className="row-2" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
            <span>{fio(e)} <span className="small muted">· {e.department?.name}</span></span>
            <button className="btn btn-secondary btn-sm" disabled={saving} onClick={() => pick(e.id)}>Выбрать</button>
          </div>
        ))}
      </div>
    </Modal>
  );
}
