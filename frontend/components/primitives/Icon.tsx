'use client';

import React from 'react';

const PATHS: Record<string, string> = {
  home: "M3 10 L12 3 L21 10 V20 A1 1 0 0 1 20 21 H15 V14 H9 V21 H4 A1 1 0 0 1 3 20 Z",
  user: "M12 12 A4 4 0 1 0 12 4 A4 4 0 0 0 12 12 M4 21 V19 A6 6 0 0 1 10 13 H14 A6 6 0 0 1 20 19 V21",
  users: "M16 11 A4 4 0 1 0 16 3 A4 4 0 0 0 16 11 M8 13 A3 3 0 1 0 8 7 A3 3 0 0 0 8 13 M2 21 V19 A4 4 0 0 1 6 15 H10 A4 4 0 0 1 14 19 V21 M14 15 A4 4 0 0 1 18 15 H18 A4 4 0 0 1 22 19 V21",
  briefcase: "M4 7 H20 V20 A1 1 0 0 1 19 21 H5 A1 1 0 0 1 4 20 Z M8 7 V5 A2 2 0 0 1 10 3 H14 A2 2 0 0 1 16 5 V7",
  bulb: "M9 18 H15 M10 21 H14 M12 3 A6 6 0 0 1 18 9 C18 12 16 14 15 15 V17 H9 V15 C8 14 6 12 6 9 A6 6 0 0 1 12 3 Z",
  heart: "M12 20 C12 20 4 14 4 8 A4 4 0 0 1 12 6 A4 4 0 0 1 20 8 C20 14 12 20 12 20 Z",
  calendar: "M4 6 H20 V20 H4 Z M4 10 H20 M8 3 V7 M16 3 V7",
  book: "M4 4 V20 A2 2 0 0 0 6 22 H20 V4 A2 2 0 0 0 18 2 H6 A2 2 0 0 0 4 4 Z M4 4 A2 2 0 0 0 6 6 H20",
  settings: "M12 15 A3 3 0 1 0 12 9 A3 3 0 0 0 12 15 M19 12 A7 7 0 0 1 18.9 13.3 L20.5 14.5 L19 17 L17.1 16.3 A7 7 0 0 1 15 17.6 L14.5 19.5 H11.5 L11 17.6 A7 7 0 0 1 8.9 16.3 L7 17 L5.5 14.5 L7.1 13.3 A7 7 0 0 1 7 12 A7 7 0 0 1 7.1 10.7 L5.5 9.5 L7 7 L8.9 7.7 A7 7 0 0 1 11 6.4 L11.5 4.5 H14.5 L15 6.4 A7 7 0 0 1 17.1 7.7 L19 7 L20.5 9.5 L18.9 10.7 A7 7 0 0 1 19 12 Z",
  bell: "M6 10 A6 6 0 0 1 18 10 V14 L20 17 H4 L6 14 Z M10 20 A2 2 0 0 0 14 20",
  search: "M10 17 A7 7 0 1 0 10 3 A7 7 0 0 0 10 17 M15 15 L21 21",
  chat: "M21 14 A2 2 0 0 1 19 16 H8 L3 21 V5 A2 2 0 0 1 5 3 H19 A2 2 0 0 1 21 5 Z",
  chart: "M4 20 V4 M4 20 H20 M8 16 V12 M12 16 V8 M16 16 V10",
  graduation: "M2 9 L12 4 L22 9 L12 14 Z M6 11 V16 C6 17 9 19 12 19 C15 19 18 17 18 16 V11 M22 9 V14",
  plus: "M12 5 V19 M5 12 H19",
  minus: "M5 12 H19",
  close: "M6 6 L18 18 M6 18 L18 6",
  check: "M5 12 L10 17 L19 7",
  arrow_right: "M5 12 H19 M13 6 L19 12 L13 18",
  arrow_down: "M12 5 V19 M6 13 L12 19 L18 13",
  chevron_down: "M6 9 L12 15 L18 9",
  chevron_right: "M9 6 L15 12 L9 18",
  chevron_left: "M15 6 L9 12 L15 18",
  edit: "M4 20 H8 L20 8 L16 4 L4 16 Z M13 7 L17 11",
  trash: "M4 7 H20 M9 7 V4 H15 V7 M6 7 L7 20 A1 1 0 0 0 8 21 H16 A1 1 0 0 0 17 20 L18 7",
  filter: "M3 5 H21 L15 12 V19 L9 21 V12 Z",
  download: "M12 4 V16 M6 12 L12 18 L18 12 M4 21 H20",
  upload: "M12 18 V4 M6 10 L12 4 L18 10 M4 21 H20",
  menu: "M3 6 H21 M3 12 H21 M3 18 H21",
  star: "M12 3 L15 9 L21 10 L16 15 L17 21 L12 18 L7 21 L8 15 L3 10 L9 9 Z",
  flag: "M4 21 V4 H18 L14 9 L18 14 H4",
  building: "M4 21 V5 A1 1 0 0 1 5 4 H11 V21 M11 21 V9 A1 1 0 0 1 12 8 H19 A1 1 0 0 1 20 9 V21 M15 12 H17 M15 16 H17 M7 8 H8 M7 12 H8 M7 16 H8 M3 21 H21",
  logout: "M9 4 H5 A1 1 0 0 0 4 5 V19 A1 1 0 0 0 5 20 H9 M16 16 L20 12 L16 8 M11 12 H20",
  grid: "M4 4 H10 V10 H4 Z M14 4 H20 V10 H14 Z M4 14 H10 V20 H4 Z M14 14 H20 V20 H14 Z",
  clipboard: "M8 4 H6 A1 1 0 0 0 5 5 V20 A1 1 0 0 0 6 21 H18 A1 1 0 0 0 19 20 V5 A1 1 0 0 0 18 4 H16 M8 4 V2 H16 V4 M8 4 H16",
  gift: "M4 10 H20 V21 H4 Z M12 10 V21 M8 10 C6 10 6 6 8 6 C10 6 12 10 12 10 C12 10 14 6 16 6 C18 6 18 10 16 10",
  compass: "M12 21 A9 9 0 1 0 12 3 A9 9 0 0 0 12 21 M8 16 L10 10 L16 8 L14 14 Z",
  shield: "M12 3 L20 6 V12 C20 17 16 20 12 21 C8 20 4 17 4 12 V6 Z",
  pin: "M12 2 C8 2 6 5 6 9 C6 14 12 22 12 22 C12 22 18 14 18 9 C18 5 16 2 12 2 Z M12 11 A2 2 0 1 0 12 7 A2 2 0 0 0 12 11",
  camera: "M4 7 H7 L9 4 H15 L17 7 H20 V19 H4 Z M12 16 A3 3 0 1 0 12 10 A3 3 0 0 0 12 16",
  file: "M6 4 H14 L18 8 V20 H6 Z M14 4 V8 H18",
  paperclip: "M14 4 L6 12 A4 4 0 0 0 12 18 L20 10 A3 3 0 0 0 16 6 L9 13 A2 2 0 0 0 11 15 L17 9",
  info: "M12 21 A9 9 0 1 0 12 3 A9 9 0 0 0 12 21 M12 11 V17 M12 7 L12 8",
  warning: "M12 3 L22 20 H2 Z M12 10 V14 M12 17 V18",
};

const CIRCLE_ICONS = ['dots', 'drag'];

export type IconName = keyof typeof PATHS | 'dots' | 'drag';

interface IconProps {
  name: string;
  size?: number;
  className?: string;
}

export function Icon({ name, size = 18, className = '' }: IconProps) {
  if (name === 'dots') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" className={`icon ${className}`} fill="none">
        <g fill="currentColor">
          <circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>
        </g>
      </svg>
    );
  }

  if (name === 'drag') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" className={`icon ${className}`} fill="none">
        <g fill="currentColor">
          <circle cx="9" cy="7" r="1.3"/><circle cx="15" cy="7" r="1.3"/>
          <circle cx="9" cy="12" r="1.3"/><circle cx="15" cy="12" r="1.3"/>
          <circle cx="9" cy="17" r="1.3"/><circle cx="15" cy="17" r="1.3"/>
        </g>
      </svg>
    );
  }

  const d = PATHS[name];
  if (!d) return null;

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={`icon ${className}`} fill="none">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
