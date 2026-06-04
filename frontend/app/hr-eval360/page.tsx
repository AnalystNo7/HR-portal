'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Icon, Modal, useToast } from '@/components/primitives';
import {
  get360Cycles, create360Cycle, delete360Cycle, Cycle360ListItem, Cycle360Status, halfLabel,
  get360Competencies, create360Competency, update360Competency, delete360Competency,
  add360Indicator, update360Indicator, delete360Indicator, CompetencyTpl,
  get360Scales, create360Scale, update360Scale, delete360Scale, ScaleTpl, ScalePoint,
} from '@/lib/api';

const STATUS_PILL: Record<Cycle360Status, string> = { DRAFT: 'pill-gray', ACTIVE: 'pill-green', CLOSED: 'pill-blue' };
const STATUS_LABEL: Record<Cycle360Status, string> = { DRAFT: 'Черновик', ACTIVE: 'Идёт оценка', CLOSED: 'Завершён' };

export default function HrEval360Page() {
  const [tab, setTab] = useState<'cycles' | 'template'>('cycles');
  return (
    <div>
      <h2 style={{ fontFamily: 'var(--font-head)', fontSize: 22, marginBottom: 16 }}>Оценка 360</h2>
      <div className="tabs" style={{ marginBottom: 16 }}>
        <button aria-selected={tab === 'cycles'} onClick={() => setTab('cycles')}>Запуски</button>
        <button aria-selected={tab === 'template'} onClick={() => setTab('template')}>Шаблон оценки</button>
      </div>
      {tab === 'cycles' ? <CyclesTab /> : <TemplateTab />}
    </div>
  );
}

// ─── Запуски ───────────────────────────────────────────
function CyclesTab() {
  const router = useRouter();
  const toast = useToast();
  const [items, setItems] = useState<Cycle360ListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [scales, setScales] = useState<ScaleTpl[]>([]);
  const [comps, setComps] = useState<CompetencyTpl[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [half, setHalf] = useState(1);
  const [scaleId, setScaleId] = useState('');
  const [selectedComps, setSelectedComps] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [delTarget, setDelTarget] = useState<{ id: string; name: string } | null>(null);
  const [delBusy, setDelBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems((await get360Cycles({ limit: 100 })).data); } catch {} finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const openCreate = async () => {
    setError(null); setName('Оценка 360'); setDescription(''); setYear(new Date().getFullYear()); setHalf(1);
    const [sc, cp] = await Promise.all([get360Scales(), get360Competencies()]);
    setScales(sc); setComps(cp);
    setScaleId(sc.find(s => s.isDefault)?.id ?? sc[0]?.id ?? '');
    setSelectedComps(new Set(cp.filter(c => c.isActive).map(c => c.id)));
    setModalOpen(true);
  };

  const toggleComp = (id: string) => setSelectedComps(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
  });

  const handleCreate = async () => {
    if (!name.trim() || !scaleId || selectedComps.size === 0) { setError('Заполните название, шкалу и хотя бы одну компетенцию'); return; }
    if (!year || (half !== 1 && half !== 2)) { setError('Укажите год и полугодие'); return; }
    setSaving(true); setError(null);
    try {
      const cycle = await create360Cycle({ name: name.trim(), description: description.trim() || null, year, half, scaleId, competencyIds: Array.from(selectedComps) });
      toast('Запуск создан');
      router.push(`/hr-eval360/${cycle.id}`);
    } catch (e) { setError((e as Error).message); } finally { setSaving(false); }
  };

  return (
    <div>
      <div className="mgr-toolbar">
        <div className="flex-1" />
        <button className="btn btn-primary btn-sm" onClick={openCreate}><Icon name="plus" size={14} /> Создать воркфлоу</button>
      </div>
      <div className="card" style={{ padding: 0 }}>
        <table className="tbl">
          <thead><tr><th>Название</th><th>Период</th><th>Подразделения</th><th>Статус</th><th>Сотрудников</th><th>Создан</th><th></th></tr></thead>
          <tbody>
            {loading && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--gpc-gray-500)' }}>Загрузка...</td></tr>}
            {!loading && items.map(c => (
              <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => router.push(`/hr-eval360/${c.id}`)}>
                <td><b>{c.name}</b>{c.description && <div className="small muted">{c.description}</div>}</td>
                <td className="small muted">{c.year ? `${c.year}, ${halfLabel(c.half)}` : '—'}</td>
                <td className="small muted">{c.departments?.length ? c.departments.join(', ') : '—'}</td>
                <td><span className={`pill ${STATUS_PILL[c.status]}`}>{STATUS_LABEL[c.status]}</span></td>
                <td>{c._count.subjects}</td>
                <td className="small muted">{new Date(c.createdAt).toLocaleDateString('ru-RU')}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  {c.status !== 'CLOSED' && <>
                    <button className="btn btn-ghost btn-sm" title="Редактировать" onClick={e => { e.stopPropagation(); router.push(`/hr-eval360/${c.id}`); }}><Icon name="edit" size={14} /></button>
                    <button className="btn btn-ghost btn-sm" title="Удалить" onClick={e => { e.stopPropagation(); setDelTarget({ id: c.id, name: c.name }); }}><Icon name="trash" size={14} /></button>
                  </>}
                </td>
              </tr>
            ))}
            {!loading && items.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--gpc-gray-500)' }}>Запусков пока нет</td></tr>}
          </tbody>
        </table>
      </div>

      <Modal open={!!delTarget} onClose={() => setDelTarget(null)} title="Удаление воркфлоу" footer={
        <><button className="btn btn-secondary" onClick={() => setDelTarget(null)}>Отмена</button>
        <button className="btn btn-primary" style={{ background: 'var(--err)' }} disabled={delBusy} onClick={async () => {
          if (!delTarget) return;
          setDelBusy(true);
          try { await delete360Cycle(delTarget.id); toast('Воркфлоу удалён'); setDelTarget(null); load(); }
          catch (e) { toast((e as Error).message); } finally { setDelBusy(false); }
        }}>Удалить</button></>
      }>
        <p>Удалить воркфлоу <b>{delTarget?.name}</b>? Действие необратимо, все данные оценки будут удалены.</p>
      </Modal>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Новый запуск оценки 360" footer={
        <><button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Отмена</button><button className="btn btn-primary" onClick={handleCreate} disabled={saving}>{saving ? 'Создание...' : 'Создать'}</button></>
      }>
        {error && <div className="form-error">{error}</div>}
        <div className="field"><label className="small">Название</label><input className="inp" value={name} onChange={e => setName(e.target.value)} placeholder="Оценка 360" autoFocus /></div>
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
        <div className="field"><label className="small">Шкала оценки</label>
          <select className="sel" value={scaleId} onChange={e => setScaleId(e.target.value)}>
            {scales.map(s => <option key={s.id} value={s.id}>{s.name} ({s.points.length} баллов)</option>)}
          </select>
        </div>
        <div className="field"><label className="small">Ценности/Компетенции (можно скорректировать после создания)</label>
          <div className="stack-2" style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid var(--line)', borderRadius: 8, padding: 10 }}>
            {comps.map(c => (
              <label key={c.id} className="row-2" style={{ alignItems: 'center', cursor: 'pointer' }}>
                <input type="checkbox" checked={selectedComps.has(c.id)} onChange={() => toggleComp(c.id)} />
                <span>{c.name} <span className="small muted">· {c.indicators.length} индикаторов</span></span>
              </label>
            ))}
            {comps.length === 0 && <div className="small muted">Сначала добавьте компетенции во вкладке «Шаблон оценки».</div>}
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─── Шаблон ────────────────────────────────────────────
const CAT_LIST_ID = 'oc360-categories';

function TemplateTab() {
  const toast = useToast();
  const [comps, setComps] = useState<CompetencyTpl[]>([]);
  const [scales, setScales] = useState<ScaleTpl[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComp, setNewComp] = useState('');
  const [newCompCat, setNewCompCat] = useState('');
  const [newInd, setNewInd] = useState<Record<string, string>>({});
  const [scaleModal, setScaleModal] = useState<ScaleTpl | 'new' | null>(null);
  const [delScale, setDelScale] = useState<ScaleTpl | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { const [c, s] = await Promise.all([get360Competencies(), get360Scales()]); setComps(c); setScales(s); }
    catch {} finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const addComp = async () => {
    if (!newComp.trim()) return;
    await create360Competency({ name: newComp.trim(), category: newCompCat.trim(), order: comps.length });
    setNewComp(''); toast('Компетенция добавлена'); load();
  };
  const patchComp = async (c: CompetencyTpl, dto: { name?: string; category?: string }) => { await update360Competency(c.id, dto); load(); };
  const removeComp = async (id: string) => { await delete360Competency(id); toast('Удалено'); load(); };
  const addInd = async (cid: string) => {
    const text = (newInd[cid] || '').trim(); if (!text) return;
    await add360Indicator(cid, { text }); setNewInd(p => ({ ...p, [cid]: '' })); load();
  };
  const removeInd = async (id: string) => { await delete360Indicator(id); load(); };
  const doDeleteScale = async () => {
    if (!delScale) return;
    try { await delete360Scale(delScale.id); toast('Шкала удалена'); setDelScale(null); load(); }
    catch (e) { toast((e as Error).message); }
  };

  if (loading) return <div className="card card-pad muted">Загрузка...</div>;

  // существующие категории (для datalist) + группировка
  const categories = Array.from(new Set(comps.map(c => c.category).filter(Boolean)));
  const groups: { cat: string; items: CompetencyTpl[] }[] = [];
  for (const c of comps) {
    const key = c.category || '';
    let g = groups.find(x => x.cat === key);
    if (!g) { g = { cat: key, items: [] }; groups.push(g); }
    g.items.push(c);
  }

  const renderComp = (c: CompetencyTpl) => (
    <div key={c.id} style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 12 }}>
      <div className="row-2" style={{ alignItems: 'center' }}>
        <input className="inp flex-1" defaultValue={c.name} onBlur={e => e.target.value !== c.name && patchComp(c, { name: e.target.value })} />
        <input className="inp" style={{ width: 200 }} list={CAT_LIST_ID} placeholder="Категория" defaultValue={c.category} onBlur={e => e.target.value !== c.category && patchComp(c, { category: e.target.value })} />
        <button className="btn btn-ghost btn-sm" onClick={() => removeComp(c.id)}><Icon name="trash" size={14} /></button>
      </div>
      <div className="stack-2" style={{ marginTop: 8, paddingLeft: 8 }}>
        {c.indicators.map(i => (
          <div key={i.id} className="row-2" style={{ alignItems: 'center' }}>
            <span className="small" style={{ color: 'var(--gpc-gray-400)' }}>•</span>
            <input className="inp flex-1" defaultValue={i.text} onBlur={e => e.target.value !== i.text && update360Indicator(i.id, { text: e.target.value }).then(load)} />
            <button className="btn btn-ghost btn-sm" onClick={() => removeInd(i.id)}><Icon name="close" size={12} /></button>
          </div>
        ))}
        <div className="row-2" style={{ alignItems: 'center' }}>
          <input className="inp flex-1" placeholder="Новый индикатор..." value={newInd[c.id] || ''} onChange={e => setNewInd(p => ({ ...p, [c.id]: e.target.value }))} onKeyDown={e => e.key === 'Enter' && addInd(c.id)} />
          <button className="btn btn-secondary btn-sm" onClick={() => addInd(c.id)}>Добавить</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="stack-4">
      <datalist id={CAT_LIST_ID}>{categories.map(cat => <option key={cat} value={cat} />)}</datalist>

      <div className="card card-pad">
        <div className="card-head"><b>Ценности/Компетенции</b></div>
        <div className="stack-3" style={{ marginTop: 12 }}>
          {groups.map(g => (
            <div key={g.cat || '—'} className="stack-2">
              <div className="sb-section-label" style={{ fontSize: 13 }}>{g.cat || 'Без категории'}</div>
              {g.items.map(renderComp)}
            </div>
          ))}
          <div className="row-2" style={{ alignItems: 'center' }}>
            <input className="inp flex-1" placeholder="Новая компетенция..." value={newComp} onChange={e => setNewComp(e.target.value)} onKeyDown={e => e.key === 'Enter' && addComp()} />
            <input className="inp" style={{ width: 200 }} list={CAT_LIST_ID} placeholder="Категория" value={newCompCat} onChange={e => setNewCompCat(e.target.value)} />
            <button className="btn btn-primary btn-sm" onClick={addComp}><Icon name="plus" size={14} /> Компетенция</button>
          </div>
        </div>
      </div>

      <div className="card card-pad">
        <div className="card-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <b>Шкалы оценки</b>
          <button className="btn btn-secondary btn-sm" onClick={() => setScaleModal('new')}><Icon name="plus" size={13} /> Создать шкалу</button>
        </div>
        <div className="stack-2" style={{ marginTop: 12 }}>
          {scales.map(s => (
            <div key={s.id} className="row-2" style={{ alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', borderBottom: '1px solid var(--line)', paddingBottom: 8 }}>
              <div className="row-2" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
                <b>{s.name}{s.isDefault && <span className="pill pill-blue" style={{ marginLeft: 8 }}>по умолчанию</span>}</b>
                <div className="row-2" style={{ flexWrap: 'wrap' }}>
                  {s.points.map(p => <span key={p.value} className="pill pill-gray">{p.value} — {p.label}</span>)}
                </div>
              </div>
              <div className="row-2">
                <button className="btn btn-ghost btn-sm" onClick={() => setScaleModal(s)}><Icon name="edit" size={14} /></button>
                <button className="btn btn-ghost btn-sm" onClick={() => setDelScale(s)}><Icon name="trash" size={14} /></button>
              </div>
            </div>
          ))}
          {scales.length === 0 && <div className="small muted">Шкал нет. Создайте шкалу, чтобы запускать оценку.</div>}
        </div>
      </div>

      {scaleModal && <ScaleModal scale={scaleModal === 'new' ? null : scaleModal} onClose={() => setScaleModal(null)} onSaved={() => { setScaleModal(null); load(); toast('Шкала сохранена'); }} />}

      <Modal open={!!delScale} onClose={() => setDelScale(null)} title="Удаление шкалы" footer={
        <><button className="btn btn-secondary" onClick={() => setDelScale(null)}>Отмена</button><button className="btn btn-primary" style={{ background: 'var(--err)' }} onClick={doDeleteScale}>Удалить</button></>
      }>
        <p>Удалить шкалу <b>{delScale?.name}</b>? Уже запущенные оценки не затронутся.</p>
      </Modal>
    </div>
  );
}

// ─── Модалка шкалы ─────────────────────────────────────
function ScaleModal({ scale, onClose, onSaved }: { scale: ScaleTpl | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [name, setName] = useState(scale?.name ?? '');
  const [isDefault, setIsDefault] = useState(scale?.isDefault ?? false);
  const [points, setPoints] = useState<ScalePoint[]>(scale?.points.map(p => ({ value: p.value, label: p.label })) ?? [
    { value: 1, label: '' }, { value: 2, label: '' },
  ]);
  const [saving, setSaving] = useState(false);

  const setPoint = (idx: number, patch: Partial<ScalePoint>) => setPoints(ps => ps.map((p, i) => i === idx ? { ...p, ...patch } : p));
  const addPoint = () => setPoints(ps => [...ps, { value: (ps[ps.length - 1]?.value ?? 0) + 1, label: '' }]);
  const removePoint = (idx: number) => setPoints(ps => ps.filter((_, i) => i !== idx));

  const save = async () => {
    if (!name.trim()) { toast('Укажите название шкалы'); return; }
    if (points.length < 2) { toast('Нужно минимум 2 балла'); return; }
    const values = points.map(p => p.value);
    if (new Set(values).size !== values.length) { toast('Значения баллов должны быть уникальны'); return; }
    if (points.some(p => !p.label.trim())) { toast('Заполните подписи всех баллов'); return; }
    setSaving(true);
    try {
      const dto = { name: name.trim(), isDefault, points: points.map(p => ({ value: p.value, label: p.label.trim() })) };
      if (scale) await update360Scale(scale.id, dto); else await create360Scale(dto);
      onSaved();
    } catch (e) { toast((e as Error).message); } finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title={scale ? 'Редактирование шкалы' : 'Новая шкала'} footer={
      <><button className="btn btn-secondary" onClick={onClose}>Отмена</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Сохранение...' : 'Сохранить'}</button></>
    }>
      <div className="field"><label className="small">Название</label><input className="inp" value={name} onChange={e => setName(e.target.value)} placeholder="Например: Стандартная 1–5" autoFocus /></div>
      <label className="row-2" style={{ alignItems: 'center', cursor: 'pointer', marginBottom: 10 }}>
        <input type="checkbox" checked={isDefault} onChange={e => setIsDefault(e.target.checked)} /> <span>Использовать по умолчанию</span>
      </label>
      <div className="field"><label className="small">Баллы шкалы</label>
        <div className="stack-2">
          {points.map((p, idx) => (
            <div key={idx} className="row-2" style={{ alignItems: 'center' }}>
              <input className="inp" style={{ width: 70 }} type="number" value={p.value} onChange={e => setPoint(idx, { value: parseInt(e.target.value, 10) || 0 })} />
              <input className="inp flex-1" placeholder="Подпись балла" value={p.label} onChange={e => setPoint(idx, { label: e.target.value })} />
              <button className="btn btn-ghost btn-sm" onClick={() => removePoint(idx)} disabled={points.length <= 2}><Icon name="close" size={12} /></button>
            </div>
          ))}
          <button className="btn btn-secondary btn-sm" onClick={addPoint}><Icon name="plus" size={13} /> Добавить балл</button>
        </div>
      </div>
    </Modal>
  );
}
