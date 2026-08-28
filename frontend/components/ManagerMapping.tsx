'use client';

import React from 'react';
import { ManagerMappingEntry } from '@/lib/api';

// Renders one detected manager and their candidate subordinates as checkboxes.
// `selected` is the set of currently-checked subordinate ids for this manager;
// `onToggle` flips a single subordinate.
export function ManagerMappingCard({
  entry,
  selected,
  onToggle,
}: {
  entry: ManagerMappingEntry;
  selected: Set<string>;
  onToggle: (subordinateId: string) => void;
}) {
  const m = entry.manager;
  const managerFio = `${m.lastName} ${m.firstName} ${m.middleName ?? ''}`.trim();

  return (
    <div className="card" style={{ padding: 16, marginBottom: 12 }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>
        Сотрудник является руководителем: {managerFio}{' '}
        <span className="muted">({m.personnelNumber})</span>
      </div>
      <div className="small muted" style={{ marginBottom: 10 }}>
        Отметьте подчинённых, которые относятся к этому руководителю:
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {entry.candidates.map(c => {
          const sub = c.employee;
          const subFio = `${sub.lastName} ${sub.firstName} ${sub.middleName ?? ''}`.trim();
          return (
            <label key={sub.id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
              <input
                type="checkbox"
                checked={selected.has(sub.id)}
                onChange={() => onToggle(sub.id)}
              />
              <span>{subFio}</span>
              <span className="muted small">({sub.personnelNumber}) · {sub.position?.name ?? ''}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

// Builds the initial selection map (managerId -> set of pre-checked subordinate ids).
// По умолчанию отмечаем всех кандидатов (админ снимает лишних).
export function initialSelection(entries: ManagerMappingEntry[]): Record<string, Set<string>> {
  const sel: Record<string, Set<string>> = {};
  for (const e of entries) {
    sel[e.manager.id] = new Set(e.candidates.map(c => c.employee.id));
  }
  return sel;
}

// Converts a selection map into the payload for applyManagerMapping.
export function selectionToEntries(
  entries: ManagerMappingEntry[],
  selection: Record<string, Set<string>>,
): { managerId: string; subordinateIds: string[] }[] {
  return entries.map(e => ({
    managerId: e.manager.id,
    subordinateIds: Array.from(selection[e.manager.id] ?? []),
  }));
}
