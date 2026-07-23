'use client';

import React, { useState } from 'react';

interface Axis { label: string; value: number | null }
interface Series { label: string; color: string; values: (number | null)[] }

/** Поле под подписи осей: самая длинная строка после переноса (~«Ответственность») + отступ. */
const LABEL_MARGIN = 140;
const LINE_H = 15;

/** Перенос длинного названия оси на 2 строки по словам (строки максимально ровные). */
function wrapLabel(label: string): string[] {
  if (label.length <= 16) return [label];
  const words = label.split(' ');
  if (words.length < 2) return [label];
  let best: [string, string] = [words[0], words.slice(1).join(' ')];
  for (let i = 2; i < words.length; i++) {
    const a = words.slice(0, i).join(' ');
    const b = words.slice(i).join(' ');
    if (Math.max(a.length, b.length) < Math.max(best[0].length, best[1].length)) best = [a, b];
  }
  return best;
}

export function RadarChart({ axes, series, min, max, size = 630, showValues = false }: {
  axes: Axis[]; series: Series[]; min: number; max: number; size?: number; showValues?: boolean;
}) {
  const [hover, setHover] = useState<{ x: number; y: number; text: string } | null>(null);
  const N = axes.length;
  const cx = size / 2;
  const cy = size / 2;
  const R = size / 2 - LABEL_MARGIN;

  const angle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / N;
  const radius = (v: number) => ((v - min) / (max - min || 1)) * R;
  const point = (i: number, r: number) => ({ x: cx + r * Math.cos(angle(i)), y: cy + r * Math.sin(angle(i)) });

  const levels: number[] = [];
  for (let lv = Math.ceil(min); lv <= max; lv++) levels.push(lv);

  const ring = (r: number) =>
    axes.map((_, i) => { const p = point(i, r); return `${p.x},${p.y}`; }).join(' ');

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ maxWidth: '100%', height: 'auto', overflow: 'visible' }}>
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
            {pts.map((p, i) => {
              const v = s.values[i];
              return (
                <g key={i}>
                  <circle cx={p.x} cy={p.y} r={3} fill={s.color} />
                  {showValues && v != null && (
                    <circle cx={p.x} cy={p.y} r={10} fill="transparent" style={{ cursor: 'pointer' }}
                      onMouseEnter={() => setHover({ x: p.x, y: p.y, text: v.toFixed(1) })}
                      onMouseLeave={() => setHover(null)} />
                  )}
                </g>
              );
            })}
          </g>
        );
      })}

      {/* подписи осей: название (с переносом до 2 строк) + средний балл */}
      {axes.map((a, i) => {
        const p = point(i, R + 14);
        const anchor = Math.abs(p.x - cx) < 8 ? 'middle' : p.x > cx ? 'start' : 'end';
        const nameLines = wrapLabel(a.label);
        const n = nameLines.length + 1;
        // блок подписи растёт от точки оси наружу: сверху — вверх, снизу — вниз, сбоку — по центру
        const y0 = p.y < cy - 8 ? p.y - (n - 1) * LINE_H
          : p.y > cy + 8 ? p.y
          : p.y - ((n - 1) * LINE_H) / 2;
        return (
          <text key={`a${i}`} textAnchor={anchor} fontSize={13} fill="var(--gpc-gray-700)">
            {nameLines.map((ln, j) => (
              <tspan key={j} x={p.x} y={y0 + j * LINE_H} dominantBaseline="middle" fontWeight={600}>{ln}</tspan>
            ))}
            <tspan x={p.x} y={y0 + nameLines.length * LINE_H} dominantBaseline="middle" fontSize={12} fill="var(--gpc-gray-500)">средний балл {a.value == null ? '—' : a.value.toFixed(1)}</tspan>
          </text>
        );
      })}

      {/* тултип со значением точки */}
      {hover && (
        <g pointerEvents="none">
          <rect x={hover.x - 20} y={hover.y - 33} width={40} height={22} rx={4} fill="var(--gpc-blue-800)" />
          <text x={hover.x} y={hover.y - 22} textAnchor="middle" dominantBaseline="middle" fontSize={13} fontWeight={600} fill="#fff">{hover.text}</text>
        </g>
      )}
    </svg>
  );
}
