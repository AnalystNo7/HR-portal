'use client';

import React, { useState, useCallback, useRef } from 'react';
import { Icon, Modal } from '@/components/primitives';
import {
  previewImport,
  executeImport,
  getManagerMapping,
  applyManagerMapping,
  ImportPreviewRow,
  ImportResult,
  ManagerMappingEntry,
} from '@/lib/api';
import { ManagerMappingCard, initialSelection, selectionToEntries } from '@/components/ManagerMapping';

type Phase = 'upload' | 'preview' | 'importing' | 'mapping' | 'result';

export default function AdminImportPage() {
  const [phase, setPhase] = useState<Phase>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ImportPreviewRow[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [mapping, setMapping] = useState<ManagerMappingEntry[]>([]);
  const [selection, setSelection] = useState<Record<string, Set<string>>>({});
  const [savingMapping, setSavingMapping] = useState(false);
  const [confirmWarnings, setConfirmWarnings] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (f: File) => {
    setFile(f);
    setError(null);
    setLoading(true);
    try {
      const parsed = await previewImport(f);
      setRows(parsed);
      setPhase('preview');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const handleImport = useCallback(async () => {
    if (!file) return;
    setConfirmWarnings(false);
    setPhase('importing');
    setError(null);
    try {
      const res = await executeImport(file);
      setResult(res);
      const entries = await getManagerMapping();
      if (entries.length > 0) {
        setMapping(entries);
        setSelection(initialSelection(entries));
        setPhase('mapping');
      } else {
        setPhase('result');
      }
    } catch (e) {
      setError((e as Error).message);
      setPhase('preview');
    }
  }, [file]);

  const toggleCandidate = useCallback((managerId: string, subordinateId: string) => {
    setSelection(prev => {
      const set = new Set(prev[managerId] ?? []);
      if (set.has(subordinateId)) set.delete(subordinateId);
      else set.add(subordinateId);
      return { ...prev, [managerId]: set };
    });
  }, []);

  const handleSaveMapping = useCallback(async () => {
    setSavingMapping(true);
    setError(null);
    try {
      await applyManagerMapping(selectionToEntries(mapping, selection));
      setPhase('result');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSavingMapping(false);
    }
  }, [mapping, selection]);

  const reset = useCallback(() => {
    setPhase('upload');
    setFile(null);
    setRows([]);
    setResult(null);
    setError(null);
    setMapping([]);
    setSelection({});
  }, []);

  const validCount = rows.filter(r => r.errors.length === 0).length;
  const errorCount = rows.filter(r => r.errors.length > 0).length;
  // строки без жёстких ошибок, но с незаполненными опциональными полями
  const warnRows = rows.filter(r => r.errors.length === 0 && (r.warnings?.length ?? 0) > 0);
  // сводка для окна подтверждения: «должность (7), подразделение (5)»
  const warnSummary = (() => {
    const counts = new Map<string, number>();
    for (const r of warnRows) for (const w of r.warnings) counts.set(w, (counts.get(w) ?? 0) + 1);
    return Array.from(counts.entries()).map(([w, n]) => `${w.replace(/^Не заполнен[оа]? /, '').toLowerCase()} (${n})`).join(', ');
  })();

  return (
    <div>
      <h2 style={{ fontFamily: 'var(--font-head)', fontSize: 22, marginBottom: 16 }}>
        Импорт сотрудников
      </h2>

      {error && (
        <div className="card" style={{ padding: 12, marginBottom: 16, background: 'var(--gpc-red-50, #fef2f2)', border: '1px solid var(--gpc-red-200, #fca5a5)' }}>
          <span style={{ color: 'var(--gpc-red-700, #b91c1c)', fontSize: 13 }}>{error}</span>
        </div>
      )}

      {/* Upload phase */}
      {(phase === 'upload' || loading) && (
        <div
          className="card"
          style={{
            padding: 60,
            textAlign: 'center',
            border: dragOver ? '2px dashed var(--gpc-blue-500, #3b82f6)' : '2px dashed var(--line, #e5e7eb)',
            background: dragOver ? 'var(--gpc-blue-50, #eff6ff)' : undefined,
            borderRadius: 12,
            cursor: loading ? 'wait' : 'pointer',
          }}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => !loading && inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            style={{ display: 'none' }}
            onChange={e => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
          {loading ? (
            <div>
              <div style={{ fontSize: 14, color: 'var(--gpc-gray-500)' }}>Загрузка и анализ файла...</div>
            </div>
          ) : (
            <div>
              <Icon name="upload" size={40} />
              <div style={{ marginTop: 12, fontSize: 15, fontWeight: 500 }}>
                Перетащите файл Excel (.xlsx) или нажмите для выбора
              </div>
              <div className="small muted" style={{ marginTop: 6 }}>
                Файл должен содержать колонки: employee_number, fio, position_name, department_name, email, data_priema
              </div>
            </div>
          )}
        </div>
      )}

      {/* Preview phase */}
      {phase === 'preview' && (
        <>
          <div className="mgr-toolbar" style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 13 }}>
              <b>{file?.name}</b>
              <span className="muted" style={{ marginLeft: 8 }}>
                {rows.length} строк, из них {validCount} валидных
                {warnRows.length > 0 && <span style={{ color: 'var(--gpc-orange-600, #ea580c)' }}>, {warnRows.length} с незаполненными полями</span>}
                {errorCount > 0 && <span style={{ color: 'var(--gpc-red-600, #dc2626)' }}>, {errorCount} с ошибками</span>}
              </span>
            </div>
            <div className="flex-1" />
            <button className="btn btn-secondary btn-sm" onClick={reset}>Отмена</button>
            <button
              className="btn btn-primary btn-sm"
              disabled={validCount === 0}
              onClick={() => (warnRows.length > 0 ? setConfirmWarnings(true) : handleImport())}
            >
              <Icon name="check" size={14} /> Импортировать ({validCount})
            </button>
          </div>
          <div className="card" style={{ padding: 0, overflow: 'auto', maxHeight: 'calc(100vh - 250px)' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th>Таб. номер</th>
                  <th>ФИО</th>
                  <th>Должность</th>
                  <th>Подразделение</th>
                  <th>Email</th>
                  <th>Дата приёма</th>
                  <th>Руководитель</th>
                  <th>Статус</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => {
                  const hasErr = row.errors.length > 0;
                  const hasWarn = !hasErr && (row.warnings?.length ?? 0) > 0;
                  const fio = [row.lastName, row.firstName, row.middleName].filter(Boolean).join(' ');
                  return (
                    <tr key={row.rowNum} style={hasErr ? { background: 'var(--gpc-red-50, #fef2f2)' } : hasWarn ? { background: 'var(--gpc-orange-50, #fff7ed)' } : undefined}>
                      <td className="small muted">{row.rowNum}</td>
                      <td className="small"><b>{row.personnelNumber}</b></td>
                      <td className="small">{fio}</td>
                      <td className="small">{row.position || '—'}</td>
                      <td className="small">{row.department || '—'}</td>
                      <td className="small">{row.email}</td>
                      <td className="small">{row.hireDate ? new Date(row.hireDate).toLocaleDateString('ru-RU') : '—'}</td>
                      <td className="small">{row.managerFio || '—'}</td>
                      <td className="small">
                        {hasErr
                          ? <span style={{ color: 'var(--gpc-red-600, #dc2626)' }}>{row.errors.join('; ')}</span>
                          : hasWarn
                            ? <span style={{ color: 'var(--gpc-orange-600, #ea580c)' }}>{row.warnings.join('; ')}</span>
                            : <span style={{ color: 'var(--gpc-green-600, #16a34a)' }}>OK</span>
                        }
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Подтверждение импорта строк с незаполненными опциональными полями */}
      {confirmWarnings && (
        <Modal open onClose={() => setConfirmWarnings(false)} title="Не все поля заполнены"
          footer={
            <>
              <button className="btn btn-secondary btn-sm" onClick={() => setConfirmWarnings(false)}>Отмена</button>
              <button className="btn btn-primary btn-sm" onClick={handleImport}>Продолжить импорт</button>
            </>
          }>
          <p style={{ fontSize: 13, marginBottom: 8 }}>
            В {warnRows.length} {warnRows.length === 1 ? 'строке' : 'строках'} не заполнено: {warnSummary}.
          </p>
          <p className="small muted">
            Эти сотрудники будут созданы с пустыми полями — их можно заполнить позже
            вручную или повторным импортом. Обязательный минимум (табельный номер,
            фамилия, имя, email) во всех этих строках есть.
          </p>
        </Modal>
      )}

      {/* Importing phase */}
      {phase === 'importing' && (
        <div className="card" style={{ padding: 60, textAlign: 'center' }}>
          <div style={{ fontSize: 15, color: 'var(--gpc-gray-500)' }}>
            Импорт данных... Это может занять несколько минут.
          </div>
        </div>
      )}

      {/* Mapping phase */}
      {phase === 'mapping' && (
        <div>
          <div className="mgr-toolbar" style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 13 }}>
              <b>Привязка руководителей</b>
              <span className="muted" style={{ marginLeft: 8 }}>
                Выявлено руководителей: {mapping.length}. Проверьте подчинённых и сохраните.
              </span>
            </div>
            <div className="flex-1" />
            <button className="btn btn-secondary btn-sm" onClick={() => setPhase('result')} disabled={savingMapping}>
              Пропустить
            </button>
            <button className="btn btn-primary btn-sm" onClick={handleSaveMapping} disabled={savingMapping}>
              <Icon name="check" size={14} /> {savingMapping ? 'Сохранение...' : 'Сохранить связи'}
            </button>
          </div>
          {mapping.map(entry => (
            <ManagerMappingCard
              key={entry.manager.id}
              entry={entry}
              selected={selection[entry.manager.id] ?? new Set()}
              onToggle={(subId) => toggleCandidate(entry.manager.id, subId)}
            />
          ))}
        </div>
      )}

      {/* Result phase */}
      {phase === 'result' && result && (
        <div>
          <div className="card" style={{ padding: 20, marginBottom: 16 }}>
            <h3 style={{ fontFamily: 'var(--font-head)', fontSize: 17, marginBottom: 12 }}>Результат импорта</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              <StatCard label="Всего строк" value={result.total} />
              <StatCard label="Создано" value={result.created} color="green" />
              <StatCard label="Обновлено" value={result.updated} color="blue" />
              <StatCard label="Руководители привязаны" value={result.managerLinked} color="blue" />
              <StatCard label="Назначена роль руководителя" value={result.managersRoleAssigned} color="green" />
              <StatCard label="Keycloak создано" value={result.keycloakCreated} color="green" />
              <StatCard label="Keycloak пропущено" value={result.keycloakSkipped} color="orange" />
            </div>
          </div>

          {result.errors.length > 0 && (
            <ResultSection
              title={`Ошибки импорта (${result.errors.length})`}
              color="red"
              items={result.errors.map(e => `Строка ${e.row} (${e.personnelNumber}): ${e.error}`)}
            />
          )}

          {result.managerNotFound.length > 0 && (
            <ResultSection
              title={`Руководитель не найден (${result.managerNotFound.length})`}
              color="orange"
              items={result.managerNotFound.map(e => `Строка ${e.row} (${e.personnelNumber}): ${e.managerFio}`)}
            />
          )}

          {result.managerAmbiguous.length > 0 && (
            <ResultSection
              title={`Неоднозначное ФИО руководителя (${result.managerAmbiguous.length})`}
              color="orange"
              items={result.managerAmbiguous.map(e => `Строка ${e.row} (${e.personnelNumber}): ${e.managerFio}`)}
            />
          )}

          {result.keycloakErrors.length > 0 && (
            <ResultSection
              title={`Ошибки Keycloak (${result.keycloakErrors.length})`}
              color="red"
              items={result.keycloakErrors.map(e => `${e.personnelNumber}: ${e.error}`)}
            />
          )}

          <div style={{ marginTop: 16 }}>
            <button className="btn btn-primary" onClick={reset}>
              <Icon name="upload" size={14} /> Импортировать ещё
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color?: string }) {
  const colorMap: Record<string, string> = {
    green: 'var(--gpc-green-600, #16a34a)',
    blue: 'var(--gpc-blue-600, #2563eb)',
    orange: 'var(--gpc-orange-600, #ea580c)',
    red: 'var(--gpc-red-600, #dc2626)',
  };

  return (
    <div style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--bg-card, #fff)', border: '1px solid var(--line, #e5e7eb)' }}>
      <div style={{ fontSize: 24, fontWeight: 700, color: color ? colorMap[color] : undefined }}>{value}</div>
      <div className="small muted">{label}</div>
    </div>
  );
}

function ResultSection({ title, color, items }: { title: string; color: string; items: string[] }) {
  const [open, setOpen] = useState(false);
  const colorMap: Record<string, { bg: string; border: string; text: string }> = {
    red: { bg: 'var(--gpc-red-50, #fef2f2)', border: 'var(--gpc-red-200, #fca5a5)', text: 'var(--gpc-red-700, #b91c1c)' },
    orange: { bg: 'var(--gpc-orange-50, #fff7ed)', border: 'var(--gpc-orange-200, #fed7aa)', text: 'var(--gpc-orange-700, #c2410c)' },
  };
  const c = colorMap[color] || colorMap.red;

  return (
    <div className="card" style={{ padding: 12, marginBottom: 12, background: c.bg, border: `1px solid ${c.border}` }}>
      <button
        onClick={() => setOpen(!open)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: c.text, fontWeight: 600, fontSize: 13, padding: 0 }}
      >
        <Icon name={open ? 'chevron_down' : 'chevron_right'} size={14} />
        {title}
      </button>
      {open && (
        <ul style={{ margin: '8px 0 0 20px', fontSize: 12, color: c.text, listStyle: 'disc' }}>
          {items.map((item, i) => <li key={i}>{item}</li>)}
        </ul>
      )}
    </div>
  );
}
