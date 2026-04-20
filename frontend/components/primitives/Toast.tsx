'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Icon } from './Icon';

const ToastCtx = createContext<(text: string) => void>(() => {});

interface ToastItem {
  id: number;
  text: string;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback((text: string) => {
    const id = Math.random();
    setItems(s => [...s, { id, text }]);
    setTimeout(() => setItems(s => s.filter(t => t.id !== id)), 2600);
  }, []);

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toast-wrap">
        {items.map(t => (
          <div key={t.id} className="toast">
            <Icon name="check" size={16} />{t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  return useContext(ToastCtx);
}
