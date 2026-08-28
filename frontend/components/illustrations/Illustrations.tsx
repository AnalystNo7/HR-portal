import React from 'react';

interface IllustrationProps {
  w?: number;
  size?: number;
  opacity?: number;
  color?: string;
  title?: string;
}

export const LogoCube = ({ size = 30 }: IllustrationProps) => (
  <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="lc1" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#FFFFFF"/>
        <stop offset="1" stopColor="#D7F0FA"/>
      </linearGradient>
    </defs>
    <path d="M20 3 L35 11 L20 19 L5 11 Z" fill="#FFFFFF"/>
    <path d="M5 11 L20 19 L20 37 L5 29 Z" fill="#D7F0FA" opacity=".95"/>
    <path d="M35 11 L20 19 L20 37 L35 29 Z" fill="#B7E3F5" opacity=".95"/>
    <path d="M20 3 L35 11 L35 29 L20 37 L5 29 L5 11 Z M20 3 L20 19 M5 11 L20 19 L35 11" stroke="#0079C2" strokeWidth="1" strokeLinejoin="round" fill="none" opacity=".5"/>
    <path d="M27 15 L32 17 L27 19 L22 17 Z" fill="#FF6919"/>
  </svg>
);

export const Cube = ({ size = 24, color = '#0079C2' }: IllustrationProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M12 2 L21 7 L12 12 L3 7 Z" fill={color} opacity=".2"/>
    <path d="M3 7 L12 12 L12 22 L3 17 Z" fill={color} opacity=".55"/>
    <path d="M21 7 L12 12 L12 22 L21 17 Z" fill={color}/>
  </svg>
);

export const PersonProfile = ({ w = 200 }: IllustrationProps) => (
  <svg width={w} height={w * 0.7} viewBox="0 0 280 196" fill="none">
    <circle cx="200" cy="100" r="80" fill="#D7F0FA" opacity=".6"/>
    <rect x="40" y="150" width="200" height="6" rx="1" fill="#0079C2"/>
    <rect x="58" y="156" width="6" height="30" fill="#033D62"/>
    <rect x="216" y="156" width="6" height="30" fill="#033D62"/>
    <rect x="70" y="110" width="80" height="40" rx="3" fill="#FFFFFF" stroke="#B7C7D1" strokeWidth="1.2"/>
    <rect x="78" y="118" width="40" height="3" rx="1" fill="#B7C7D1"/>
    <rect x="78" y="126" width="60" height="3" rx="1" fill="#B7C7D1"/>
    <rect x="78" y="134" width="30" height="3" rx="1" fill="#0079C2"/>
    <path d="M140 116 L148 124 L146 140 L132 142 Z" fill="#FF6919" opacity=".25"/>
    <path d="M160 102 Q178 95 195 102 L200 150 L155 150 Z" fill="#0079C2"/>
    <path d="M160 115 Q140 118 120 125 Q116 125 116 122 Q135 110 160 108 Z" fill="#0079C2"/>
    <circle cx="180" cy="82" r="16" fill="#FFD9B8"/>
    <path d="M168 70 Q170 60 180 58 Q192 60 193 74 Q193 77 188 78 L172 78 Q168 77 168 70 Z" fill="#2E3944"/>
    <rect x="30" y="130" width="18" height="20" fill="#FF6919" opacity=".85"/>
    <path d="M39 130 Q32 118 34 108 Q42 112 39 130 Z" fill="#1F9D5E"/>
    <path d="M39 130 Q46 118 50 110 Q50 120 39 130 Z" fill="#1F9D5E" opacity=".8"/>
  </svg>
);

export const PeopleTalk = ({ w = 200 }: IllustrationProps) => (
  <svg width={w} height={w * 0.7} viewBox="0 0 280 196" fill="none">
    <circle cx="140" cy="100" r="82" fill="#D7F0FA" opacity=".55"/>
    <rect x="100" y="30" width="80" height="34" rx="6" fill="#FFFFFF" stroke="#0079C2"/>
    <path d="M116 64 L122 72 L128 64 Z" fill="#FFFFFF" stroke="#0079C2"/>
    <circle cx="118" cy="47" r="3" fill="#0079C2"/>
    <circle cx="140" cy="47" r="3" fill="#0079C2"/>
    <circle cx="162" cy="47" r="3" fill="#0079C2"/>
    <circle cx="80" cy="110" r="14" fill="#FFD9B8"/>
    <path d="M68 100 Q72 88 80 88 Q90 88 92 100 Q91 106 80 106 Q72 106 68 100 Z" fill="#FF6919"/>
    <path d="M60 150 Q64 120 80 118 Q96 120 100 150 L100 180 L60 180 Z" fill="#FF6919"/>
    <circle cx="200" cy="110" r="14" fill="#FFD9B8"/>
    <path d="M188 96 Q192 84 200 84 Q210 86 212 98 Q210 108 200 108 Q192 108 188 96 Z" fill="#033D62"/>
    <path d="M180 150 Q184 120 200 118 Q216 120 220 150 L220 180 L180 180 Z" fill="#0079C2"/>
    <rect x="104" y="136" width="22" height="28" rx="2" fill="#FFFFFF" stroke="#B7C7D1"/>
    <rect x="154" y="136" width="22" height="28" rx="2" fill="#FFFFFF" stroke="#B7C7D1"/>
    <path d="M108 144 L122 144 M108 150 L118 150 M158 144 L172 144 M158 150 L170 150" stroke="#0079C2" strokeWidth="1.2"/>
  </svg>
);

export const Vacation = ({ w = 200 }: IllustrationProps) => (
  <svg width={w} height={w * 0.72} viewBox="0 0 280 200" fill="none">
    <circle cx="140" cy="110" r="90" fill="#FFE8D4" opacity=".55"/>
    <rect x="80" y="50" width="120" height="100" rx="8" fill="#FFFFFF" stroke="#0079C2" strokeWidth="1.5"/>
    <rect x="80" y="50" width="120" height="24" rx="8" fill="#0079C2"/>
    <rect x="80" y="64" width="120" height="10" fill="#0079C2"/>
    <circle cx="105" cy="46" r="4" fill="#033D62"/>
    <circle cx="175" cy="46" r="4" fill="#033D62"/>
    <rect x="104" y="40" width="2" height="14" fill="#033D62"/>
    <rect x="174" y="40" width="2" height="14" fill="#033D62"/>
    {[0,1,2,3,4,5,6].map(c => [0,1,2,3].map(r => (
      <rect key={`${r}-${c}`} x={94 + c*15} y={84 + r*15} width="10" height="10" rx="1" fill={(r===1 && c>=2 && c<=5) ? '#FF6919' : '#ECECEC'}/>
    )))}
    <circle cx="230" cy="50" r="18" fill="#FFC198"/>
    <circle cx="230" cy="50" r="12" fill="#FF6919"/>
  </svg>
);

export const Team = ({ w = 200 }: IllustrationProps) => (
  <svg width={w} height={w * 0.7} viewBox="0 0 280 196" fill="none">
    <circle cx="140" cy="100" r="82" fill="#D7F0FA" opacity=".6"/>
    {[
      { x: 80, color: '#FF6919' }, { x: 140, color: '#0079C2' }, { x: 200, color: '#033D62' }
    ].map((p, i) => (
      <g key={i}>
        <circle cx={p.x} cy="100" r="14" fill="#FFD9B8"/>
        <path d={`M${p.x-12} 88 Q${p.x-8} 76 ${p.x} 76 Q${p.x+10} 78 ${p.x+12} 90 Q${p.x+10} 100 ${p.x} 100 Q${p.x-8} 100 ${p.x-12} 88 Z`} fill={p.color}/>
        <path d={`M${p.x-20} 140 Q${p.x-16} 112 ${p.x} 110 Q${p.x+16} 112 ${p.x+20} 140 L${p.x+20} 170 L${p.x-20} 170 Z`} fill={p.color}/>
      </g>
    ))}
  </svg>
);

export const Support = ({ w = 180 }: IllustrationProps) => (
  <svg width={w} height={w * 0.75} viewBox="0 0 240 180" fill="none">
    <circle cx="120" cy="90" r="75" fill="#D7F0FA" opacity=".55"/>
    <circle cx="80" cy="80" r="16" fill="#FFD9B8"/>
    <path d="M64 82 Q64 68 80 66 Q96 68 96 82" stroke="#2E3944" strokeWidth="3" fill="none"/>
    <rect x="62" y="80" width="4" height="8" rx="2" fill="#0079C2"/>
    <rect x="94" y="80" width="4" height="8" rx="2" fill="#0079C2"/>
    <path d="M60 130 Q66 96 80 96 Q96 98 100 130 L100 160 L60 160 Z" fill="#0079C2"/>
    <rect x="96" y="86" width="2" height="10" fill="#2E3944"/>
    <circle cx="97" cy="97" r="2" fill="#FF6919"/>
    <circle cx="170" cy="86" r="14" fill="#FFD9B8"/>
    <path d="M158 78 Q160 68 170 68 Q180 70 180 80" stroke="#2E3944" strokeWidth="3" fill="none"/>
    <path d="M152 130 Q156 104 170 104 Q184 106 188 130 L188 160 L152 160 Z" fill="#FF6919"/>
    <path d="M104 136 L148 136 L152 150 L100 150 Z" fill="#033D62"/>
    <rect x="108" y="118" width="36" height="20" rx="2" fill="#FFFFFF" stroke="#0079C2"/>
    <path d="M114 124 L138 124 M114 130 L134 130" stroke="#0079C2" strokeWidth="1.3"/>
  </svg>
);

export const EmptyCube = ({ w = 120 }: IllustrationProps) => (
  <svg width={w} height={w * 0.9} viewBox="0 0 120 108" fill="none">
    <ellipse cx="60" cy="94" rx="40" ry="6" fill="#ECECEC"/>
    <path d="M60 18 L92 34 L60 50 L28 34 Z" fill="#D7F0FA"/>
    <path d="M28 34 L60 50 L60 84 L28 68 Z" fill="#B7E3F5"/>
    <path d="M92 34 L60 50 L60 84 L92 68 Z" fill="#0079C2" opacity=".25"/>
    <path d="M60 18 L92 34 L92 68 L60 84 L28 68 L28 34 Z M60 18 L60 50 M28 34 L60 50 L92 34" stroke="#0079C2" strokeWidth="1" strokeLinejoin="round" fill="none" opacity=".4"/>
  </svg>
);

export const Lightbulb = ({ w = 220 }: IllustrationProps) => (
  <svg width={w} height={w * 0.72} viewBox="0 0 240 172" fill="none">
    <defs>
      <radialGradient id="lb1" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor="#47D8FF" stopOpacity="0.5"/>
        <stop offset="1" stopColor="#0079C2" stopOpacity="0"/>
      </radialGradient>
    </defs>
    <circle cx="120" cy="76" r="80" fill="url(#lb1)"/>
    <path d="M120 26 Q88 26 88 62 Q88 82 104 96 L104 110 L136 110 L136 96 Q152 82 152 62 Q152 26 120 26 Z" fill="#FFC198"/>
    <path d="M120 26 Q88 26 88 62 Q88 82 104 96" stroke="#FF6919" strokeWidth="2" fill="none"/>
    <rect x="106" y="112" width="28" height="6" rx="2" fill="#2E3944"/>
    <rect x="108" y="120" width="24" height="4" rx="2" fill="#2E3944"/>
    <rect x="110" y="126" width="20" height="4" rx="2" fill="#2E3944"/>
    <path d="M120 10 L120 4 M88 22 L82 14 M152 22 L158 14 M68 52 L60 50 M172 52 L180 50" stroke="#FF6919" strokeWidth="2" strokeLinecap="round"/>
    <path d="M112 52 Q116 64 120 58 Q124 64 128 52" stroke="#FF6919" strokeWidth="1.5" fill="none"/>
  </svg>
);

export const Referral = ({ w = 160 }: IllustrationProps) => (
  <svg width={w} height={w * 0.8} viewBox="0 0 200 160" fill="none">
    <circle cx="100" cy="80" r="68" fill="#D7F0FA" opacity=".6"/>
    <circle cx="72" cy="60" r="12" fill="#FFD9B8"/>
    <circle cx="128" cy="60" r="12" fill="#FFD9B8"/>
    <path d="M54 130 Q58 96 72 94 Q86 96 90 130 Z" fill="#0079C2"/>
    <path d="M110 130 Q114 96 128 94 Q142 96 146 130 Z" fill="#FF6919"/>
    <path d="M100 60 C96 52 84 52 84 62 C84 72 100 82 100 82 C100 82 116 72 116 62 C116 52 104 52 100 60 Z" fill="#FF6919"/>
  </svg>
);

export const Book = ({ w = 120, color = '#D65200', title = 'Книга' }: IllustrationProps) => (
  <svg width={w} height={w * 1.3} viewBox="0 0 120 156" fill="none">
    <rect x="8" y="4" width="104" height="148" rx="4" fill={color}/>
    <rect x="14" y="10" width="92" height="136" rx="2" fill={color} stroke="rgba(255,255,255,.2)"/>
    <path d="M26 30 L94 30 M26 40 L80 40" stroke="#FFFFFF" strokeWidth="1.5" opacity=".9"/>
    <text x="60" y="90" fontFamily="PT Sans Narrow, sans-serif" fontWeight="700" fontSize="16" fill="#FFFFFF" textAnchor="middle">{title}</text>
    <rect x="8" y="4" width="6" height="148" fill="rgba(0,0,0,.2)"/>
  </svg>
);

export const CubePattern = ({ w = 200, opacity = 0.1 }: IllustrationProps) => (
  <svg width={w} height={w * 0.6} viewBox="0 0 200 120" fill="none" style={{ opacity }}>
    {[[40,40],[80,20],[120,40],[160,20],[40,80],[80,60],[120,80],[160,60]].map(([x,y], i) => (
      <g key={i} transform={`translate(${x},${y})`}>
        <path d="M0 0 L16 8 L0 16 L-16 8 Z" fill="#FFFFFF"/>
        <path d="M-16 8 L0 16 L0 32 L-16 24 Z" fill="#FFFFFF" opacity=".7"/>
        <path d="M16 8 L0 16 L0 32 L16 24 Z" fill="#FFFFFF" opacity=".5"/>
      </g>
    ))}
  </svg>
);

export const Illustrations = {
  LogoCube,
  Cube,
  PersonProfile,
  PeopleTalk,
  Vacation,
  Team,
  Support,
  EmptyCube,
  Lightbulb,
  Referral,
  Book,
  CubePattern,
};
