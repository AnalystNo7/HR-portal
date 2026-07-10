'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Icon, initials, avColorFor } from '@/components/primitives';
import { EmptyCube } from '@/components/illustrations/Illustrations';
import { getEmployees, getDepartments, Employee, PaginatedResult } from '@/lib/api';

type Tab = 'all' | 'vac' | 'comp' | 'req' | 'surv';

export default function HRPage() {
  const [tab, setTab] = useState<Tab>('all');

  return (
    <div>
      <div className="tabs">
        {[
          { id: 'all' as Tab, label: 'Все сотрудники' },
          { id: 'vac' as Tab, label: 'Отклики на вакансии' },
          { id: 'comp' as Tab, label: 'Компетенции' },
          { id: 'req' as Tab, label: 'Обращения' },
          { id: 'surv' as Tab, label: 'Опросы и рассылки' },
        ].map(t => (
          <button key={t.id} aria-selected={tab === t.id} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>

      {tab === 'all' && <HRAllTab />}
      {tab !== 'all' && (
        <div className="card" style={{ padding: 40 }}>
          <div className="empty">
            <div className="ill"><EmptyCube w={120} /></div>
            <h3 style={{ fontFamily: 'var(--font-head)', fontSize: 20 }}>Модуль в разработке</h3>
            <p style={{ maxWidth: 440, margin: '8px auto' }}>Запуск — III квартал 2025.</p>
          </div>
        </div>
      )}
    </div>
  );
}

function HRAllTab() {
  const [data, setData] = useState<PaginatedResult<Employee> | null>(null);
  const [departments, setDepartments] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('');
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getEmployees({
        page,
        limit: 25,
        search: search || undefined,
        department: department || undefined,
      });
      setData(result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [page, search, department]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    getDepartments().then(setDepartments).catch(() => {});
  }, []);

  if (error) {
    return (
      <div className="card" style={{ padding: 40, textAlign: 'center' }}>
        <div className="empty">
          <div className="ill"><EmptyCube w={100} /></div>
          <h3>Не удалось загрузить данные</h3>
          <p className="small muted">{error}</p>
          <p className="small muted">Проверьте, что backend запущен на порту 4000 и PostgreSQL поднят.</p>
          <button className="btn btn-primary" onClick={load} style={{ marginTop: 12 }}>Повторить</button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mgr-toolbar">
        <div className="hdr-search" style={{ margin: 0, flex: '0 0 320px' }}>
          <Icon name="search" size={16} />
          <input
            placeholder="ФИО, табельный, должность..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select
          className="sel"
          style={{ width: 240, height: 30 }}
          value={department}
          onChange={(e) => { setDepartment(e.target.value); setPage(1); }}
        >
          <option value="">Все подразделения</option>
          {departments.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <div className="flex-1" />
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
            {loading && (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--gpc-gray-500)' }}>Загрузка...</td></tr>
            )}
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
                  <td><a href="#" className="job-link" onClick={e => e.preventDefault()}>{p.position?.name ?? ''}</a></td>
                  <td className="small">{p.email}</td>
                  <td className="small"><b>{p.personnelNumber}</b></td>
                  <td><button className="btn btn-ghost btn-sm"><Icon name="dots" size={16} /></button></td>
                </tr>
              );
            })}
            {!loading && data && data.data.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--gpc-gray-500)' }}>Ничего не найдено</td></tr>
            )}
          </tbody>
        </table>
        {data && data.totalPages > 1 && (
          <div style={{
            padding: '12px 16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderTop: '1px solid var(--line)',
            fontSize: 12,
            color: 'var(--gpc-gray-500)',
          }}>
            <span>Всего: {data.total}, страница {data.page} из {data.totalPages}</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                <Icon name="chevron_left" size={14} />
              </button>
              <button className="btn btn-primary btn-sm" style={{ minWidth: 30, padding: 0 }}>{page}</button>
              <button className="btn btn-secondary btn-sm" disabled={page >= data.totalPages} onClick={() => setPage(p => p + 1)}>
                <Icon name="chevron_right" size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
