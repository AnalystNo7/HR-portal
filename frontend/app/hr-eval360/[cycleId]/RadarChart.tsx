'use client';

import React from 'react';

interface Axis { label: string; value: number | null }
interface Series { label: string; color: string; values: (number | null)[] }

export function RadarChart({ axes, series, min, max, size = 320 }: {
  axes: Axis[]; series: Series[]; min: number; max: number; size?: number;
}) {
  const N = axes.length;
  const cx = size / 2;
  const cy = size / 2;
  const R = size / 2 - 56; // запас под подписи осей

  const angle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / N;
  const radius = (v: number) => ((v - min) / (max - min || 1)) * R;
  const point = (i: number, r: number) => ({ x: cx + r * Math.cos(angle(i)), y: cy + r * Math.sin(angle(i)) });

  const levels: number[] = [];
  for (let lv = Math.ceil(min); lv <= max; lv++) levels.push(lv);

  const ring = (r: number) =>
    axes.map((_, i) => { const p = point(i, r); return `${p.x},${p.y}`; }).join(' ');

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ maxWidth: '100%', height: 'auto' }}>
      {/* кольца сетки + подписи уровней */}
      {levels.map(lv => (
        <polygon key={lv} points={ring(radius(lv))} fill="none" stroke="var(--line)" strokeWidth={1} />
      ))}
      {levels.map(lv => (
        <text key={`l${lv}`} x={cx + 4} y={cy - radius(lv)} fontSize={9} fill="var(--gpc-gray-400)" dominantBaseline="middle">{lv}</text>
      ))}

      {/* спицы */}
      {axes.map((_, i) => { const p = point(i, R); return (
        <line key={`s${i}`} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="var(--line)" strokeWidth={1} />
      ); })}

      {/* полигоны серий */}
      {series.map(s => {
        const pts = s.values.map((v, i) => point(i, radius(v ?? min)));
        const poly = pts.map(p => `${p.x},${p.y}`).join(' ');
        return (
          <g key={s.label}>
            <polygon points={poly} fill={s.color} fillOpacity={0.12} stroke={s.color} strokeWidth={2} strokeLinejoin="round" />
            {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={3} fill={s.color} />)}
          </g>
        );
      })}

      {/* подписи осей: название + средний балл */}
      {axes.map((a, i) => {
        const p = point(i, R + 18);
        const anchor = Math.abs(p.x - cx) < 8 ? 'middle' : p.x > cx ? 'start' : 'end';
        return (
          <text key={`a${i}`} x={p.x} y={p.y} textAnchor={anchor} dominantBaseline="middle" fontSize={11} fill="var(--gpc-gray-700)">
            <tspan x={p.x} fontWeight={600}>{a.label}</tspan>
            <tspan x={p.x} dy={13} fontSize={10} fill="var(--gpc-gray-500)">средний балл {a.value == null ? '—' : a.value.toFixed(1)}</tspan>
          </text>
        );
      })}
    </svg>
  );
}
