'use client';

import React from 'react';

const PALETTE = ['blue', 'orange', 'green', 'peach', 'purple'] as const;

export function initials(name: string): string {
  return (name || '').split(/\s+/).filter(Boolean).slice(0, 2).map(n => n[0]).join('').toUpperCase();
}

export function avColorFor(name: string): string {
  const hash = (name || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return PALETTE[hash % PALETTE.length];
}

interface AvatarProps {
  name: string;
  size?: 'sm' | 'md' | 'lg';
  color?: string;
}

export function Avatar({ name, size = 'md', color }: AvatarProps) {
  return (
    <div className={`av-${size} av-${color || avColorFor(name)}`}>
      {initials(name)}
    </div>
  );
}
