'use client';

import React from 'react';
import type { CompetencyResult } from '@/lib/api';
import { RadarChart } from './RadarChart';
import { catLabel, scaleColor } from './helpers';

/**
 * Карточка категории компетенций в стиле вкладки «Дашборд»
 * (как на диаграммах PDF-отчёта): заголовок, пилюля уровня группы, radar.
 */
export function CategoryRadarCard({ cat, items, series, min, max, size = 680 }: {
  cat: string;
  items: CompetencyResult[];
  series: { label: string; color: string; values: (number | null)[] }[];
  min: number;
  max: number;
  size?: number;
}) {
  const totals = items.map(c => c.total).filter((v): v is number => v != null);
  const grp = totals.length ? totals.reduce((a, b) => a + b, 0) / totals.length : null;
  const axes = items.map(c => ({ label: c.name, value: c.total }));
  return (
    <div className="card card-pad" style={{ flex: '1 1 0', minWidth: 340 }} data-radar-cat={catLabel(cat)}>
      <b>{catLabel(cat)}</b>
      <div className="row-2" style={{ alignItems: 'center', gap: 6, marginTop: 4 }}>
        <span className="small muted">Уровень развития группы компетенций</span>
        <span className="pill" style={{ background: scaleColor(grp), color: '#fff' }}>{grp == null ? '—' : grp.toFixed(1)}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
        <RadarChart axes={axes} series={series} min={min} max={max} size={size} showValues />
      </div>
    </div>
  );
}
