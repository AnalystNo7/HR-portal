'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Icon } from '@/components/primitives';
import { Modal } from '@/components/primitives';
import { useToast } from '@/components/primitives';
import { getDepartmentsList, createDepartment, updateDepartment, deleteDepartment, Department } from '@/lib/api';

export default function AdminDepartmentsPage() {
  const [items, setItems] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Department | null>(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await getDepartmentsList());
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); setName(''); setError(null); setModalOpen(true); };
  const openEdit = (item: Department) => { setEditing(item); setName(item.name); setError(null); setModalOpen(true); };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      if (editing) {
        await updateDepartment(editing.id, { name: name.trim() });
        toast('Подразделение обновлено');
      } else {
        await createDepartment({ name: name.trim() });
        toast('Подразделение создано');
      }
      setModalOpen(false);
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setError(null);
    try {
      await deleteDepartment(deleteTarget.id);
      toast('Подразделение удалено');
      setDeleteTarget(null);
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div>
      <h2 style={{ fontFamily: 'var(--font-head)', fontSize: 22, marginBottom: 16 }}>Подразделения</h2>
      <div className="mgr-toolbar">
        <div className="flex-1" />
        <button className="btn btn-primary btn-sm" onClick={openCreate}><Icon name="plus" size={14} /> Добавить</button>
      </div>
      <div className="card" style={{ padding: 0 }}>
        <table className="tbl">
          <thead><tr><th>Название</th><th style={{ width: 100 }}></th></tr></thead>
          <tbody>
            {loading && <tr><td colSpan={2} style={{ textAlign: 'center', padding: 40, color: 'var(--gpc-gray-500)' }}>Загрузка...</td></tr>}
            {!loading && items.map(item => (
              <tr key={item.id}>
                <td>{item.name}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => openEdit(item)}><Icon name="edit" size={14} /></button>
                  <button className="btn btn-ghost btn-sm" onClick={() => { setError(null); setDeleteTarget(item); }}><Icon name="trash" size={14} /></button>
                </td>
              </tr>
            ))}
            {!loading && items.length === 0 && <tr><td colSpan={2} style={{ textAlign: 'center', padding: 40, color: 'var(--gpc-gray-500)' }}>Нет подразделений</td></tr>}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Редактирование' : 'Новое подразделение'} footer={
        <><button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Отмена</button><button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Сохранение...' : 'Сохранить'}</button></>
      }>
        {error && <div style={{ marginBottom: 12, padding: 8, background: 'var(--gpc-red-50, #fef2f2)', border: '1px solid var(--gpc-red-200, #fca5a5)', borderRadius: 6, color: 'var(--gpc-red-700, #b91c1c)', fontSize: 13 }}>{error}</div>}
        <div className="field"><label className="small">Название</label><input className="inp" value={name} onChange={e => setName(e.target.value)} autoFocus /></div>
      </Modal>

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Удаление подразделения" footer={
        <><button className="btn btn-secondary" onClick={() => setDeleteTarget(null)}>Отмена</button><button className="btn btn-primary" style={{ background: 'var(--err, #dc2626)' }} onClick={handleDelete}>Удалить</button></>
      }>
        {error && <div style={{ marginBottom: 12, padding: 8, background: 'var(--gpc-red-50, #fef2f2)', border: '1px solid var(--gpc-red-200, #fca5a5)', borderRadius: 6, color: 'var(--gpc-red-700, #b91c1c)', fontSize: 13 }}>{error}</div>}
        <p>Удалить подразделение <b>{deleteTarget?.name}</b>?</p>
      </Modal>
    </div>
  );
}
