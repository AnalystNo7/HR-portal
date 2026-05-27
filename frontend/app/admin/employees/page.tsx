'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Icon, initials, avColorFor } from '@/components/primitives';
import { Modal } from '@/components/primitives';
import { useToast } from '@/components/primitives';
import {
  getEmployees, getDepartmentsList, getPositionsList,
  createEmployee, updateEmployee, deleteEmployee,
  Employee, Department, Position, PaginatedResult, CreateEmployeeInput,
} from '@/lib/api';

export default function AdminEmployeesPage() {
  const [data, setData] = useState<PaginatedResult<Employee> | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [page, setPage] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  const [form, setForm] = useState<CreateEmployeeInput>({
    personnelNumber: '', lastName: '', firstName: '', middleName: '',
    email: '', departmentId: '', positionId: '', hireDate: '', managerId: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getEmployees({
        page, limit: 25,
        search: search || undefined,
        department: deptFilter || undefined,
      });
      setData(result);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [page, search, deptFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    getDepartmentsList().then(setDepartments).catch(() => {});
    getPositionsList().then(setPositions).catch(() => {});
    getEmployees({ limit: 1000 }).then(r => setAllEmployees(r.data)).catch(() => {});
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ personnelNumber: '', lastName: '', firstName: '', middleName: '', email: '', departmentId: '', positionId: '', hireDate: '', managerId: '' });
    setError(null);
    setModalOpen(true);
  };

  const openEdit = (emp: Employee) => {
    setEditing(emp);
    setForm({
      personnelNumber: emp.personnelNumber,
      lastName: emp.lastName,
      firstName: emp.firstName,
      middleName: emp.middleName || '',
      email: emp.email,
      departmentId: emp.departmentId,
      positionId: emp.positionId,
      hireDate: emp.hireDate ? emp.hireDate.slice(0, 10) : '',
      managerId: emp.managerId || '',
    });
    setError(null);
    setModalOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const dto = { ...form };
      if (!dto.middleName) delete dto.middleName;
      if (!dto.hireDate) delete dto.hireDate;
      if (!dto.managerId) delete dto.managerId;

      if (editing) {
        await updateEmployee(editing.id, dto);
        toast('Данные обновлены');
      } else {
        await createEmployee(dto);
        toast('Сотрудник создан');
      }
      setModalOpen(false);
      load();
      getEmployees({ limit: 1000 }).then(r => setAllEmployees(r.data)).catch(() => {});
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteEmployee(deleteTarget.id);
      toast('Сотрудник удалён');
      setDeleteTarget(null);
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const setField = (key: keyof CreateEmployeeInput, value: string) => {
    setForm(f => ({ ...f, [key]: value }));
  };

  return (
    <div>
      <h2 style={{ fontFamily: 'var(--font-head)', fontSize: 22, marginBottom: 16 }}>Сотрудники</h2>

      <div className="mgr-toolbar">
        <div className="hdr-search" style={{ margin: 0, flex: '0 0 320px' }}>
          <Icon name="search" size={16} />
          <input placeholder="ФИО, email, должность..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select className="sel" style={{ width: 240, height: 30 }} value={deptFilter} onChange={e => { setDeptFilter(e.target.value); setPage(1); }}>
          <option value="">Все подразделения</option>
          {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
        </select>
        <div className="flex-1" />
        <button className="btn btn-primary btn-sm" onClick={openCreate}><Icon name="plus" size={14} /> Новый сотрудник</button>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>Сотрудник</th>
              <th>Подразделение</th>
              <th>Должность</th>
              <th>E-mail</th>
              <th>Табельный</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--gpc-gray-500)' }}>Загрузка...</td></tr>}
            {!loading && data?.data.map(p => {
              const fullName = `${p.lastName} ${p.firstName} ${p.middleName ?? ''}`.trim();
              return (
                <tr key={p.id}>
                  <td>
                    <div className="avatar-cell">
                      <div className={`av av-${avColorFor(fullName)}`}>{initials(fullName)}</div>
                      <div>
                        <div style={{ fontWeight: 600 }}>{fullName}</div>
                        <div className="small muted">{p.position?.name ?? ''}</div>
                      </div>
                    </div>
                  </td>
                  <td className="small">{p.department?.name ?? ''}</td>
                  <td className="small">{p.position?.name ?? ''}</td>
                  <td className="small">{p.email}</td>
                  <td className="small"><b>{p.personnelNumber}</b></td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(p)}><Icon name="edit" size={14} /></button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setDeleteTarget(p)}><Icon name="trash" size={14} /></button>
                  </td>
                </tr>
              );
            })}
            {!loading && data && data.data.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--gpc-gray-500)' }}>Ничего не найдено</td></tr>
            )}
          </tbody>
        </table>
        {data && data.totalPages > 1 && (
          <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--line)', fontSize: 12, color: 'var(--gpc-gray-500)' }}>
            <span>Всего: {data.total}, страница {data.page} из {data.totalPages}</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><Icon name="chevron_left" size={14} /></button>
              <button className="btn btn-primary btn-sm" style={{ minWidth: 30, padding: 0 }}>{page}</button>
              <button className="btn btn-secondary btn-sm" disabled={page >= data.totalPages} onClick={() => setPage(p => p + 1)}><Icon name="chevron_right" size={14} /></button>
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Редактирование сотрудника' : 'Новый сотрудник'}
        size="lg"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Отмена</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Сохранение...' : 'Сохранить'}</button>
          </>
        }
      >
        {error && <div style={{ marginBottom: 12, padding: 8, background: 'var(--gpc-red-50, #fef2f2)', border: '1px solid var(--gpc-red-200, #fca5a5)', borderRadius: 6, color: 'var(--gpc-red-700, #b91c1c)', fontSize: 13 }}>{error}</div>}
        <div className="grid-2">
          <div className="field"><label className="small">Табельный номер</label><input className="inp" value={form.personnelNumber} onChange={e => setField('personnelNumber', e.target.value)} /></div>
          <div className="field"><label className="small">Email</label><input className="inp" type="email" value={form.email} onChange={e => setField('email', e.target.value)} /></div>
          <div className="field"><label className="small">Фамилия</label><input className="inp" value={form.lastName} onChange={e => setField('lastName', e.target.value)} /></div>
          <div className="field"><label className="small">Имя</label><input className="inp" value={form.firstName} onChange={e => setField('firstName', e.target.value)} /></div>
          <div className="field"><label className="small">Отчество</label><input className="inp" value={form.middleName} onChange={e => setField('middleName', e.target.value)} /></div>
          <div className="field"><label className="small">Дата приёма</label><input className="inp" type="date" value={form.hireDate} onChange={e => setField('hireDate', e.target.value)} /></div>
          <div className="field">
            <label className="small">Подразделение</label>
            <select className="sel" value={form.departmentId} onChange={e => setField('departmentId', e.target.value)}>
              <option value="">— Выберите —</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="small">Должность</label>
            <select className="sel" value={form.positionId} onChange={e => setField('positionId', e.target.value)}>
              <option value="">— Выберите —</option>
              {positions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <label className="small">Руководитель</label>
            <select className="sel" value={form.managerId} onChange={e => setField('managerId', e.target.value)}>
              <option value="">— Нет —</option>
              {allEmployees.filter(e => e.id !== editing?.id).map(e => (
                <option key={e.id} value={e.id}>{e.lastName} {e.firstName} {e.middleName ?? ''}</option>
              ))}
            </select>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Удаление сотрудника"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setDeleteTarget(null)}>Отмена</button>
            <button className="btn btn-primary" style={{ background: 'var(--err, #dc2626)' }} onClick={handleDelete}>Удалить</button>
          </>
        }
      >
        {error && <div style={{ marginBottom: 12, padding: 8, background: 'var(--gpc-red-50, #fef2f2)', border: '1px solid var(--gpc-red-200, #fca5a5)', borderRadius: 6, color: 'var(--gpc-red-700, #b91c1c)', fontSize: 13 }}>{error}</div>}
        <p>Вы уверены, что хотите удалить сотрудника <b>{deleteTarget?.lastName} {deleteTarget?.firstName}</b>?</p>
      </Modal>
    </div>
  );
}
