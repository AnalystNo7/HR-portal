'use client';

import React, { useState } from 'react';
import { Modal, Icon, useToast } from '@/components/primitives';
import { useAuth } from '@/contexts/AuthContext';
import { createAppeal } from '@/lib/api';

const DIRECTIONS = [
  { id: 'HR и кадры', label: 'HR и кадры', hint: 'Справки, трудовая, отпуска, ДМС' },
  { id: 'ИТ-поддержка', label: 'ИТ-поддержка', hint: 'Оборудование, доступы, аккаунты' },
  { id: 'АХО и офис', label: 'АХО и офис', hint: 'Пропуска, офисное пространство' },
  { id: 'Финансы и ЗП', label: 'Финансы и ЗП', hint: 'Расчётные листки, командировки' },
  { id: 'Юридическая служба', label: 'Юридическая служба', hint: 'Договоры, NDA, правовые вопросы' },
  { id: 'Служба безопасности', label: 'Служба безопасности', hint: 'Пропуска, информационная безопасность' },
];

interface FeedbackModalProps {
  open: boolean;
  onClose: () => void;
}

export function FeedbackModal({ open, onClose }: FeedbackModalProps) {
  const [direction, setDirection] = useState('');
  const [subject, setSubject] = useState('');
  const [text, setText] = useState('');
  const [anon, setAnon] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const { user } = useAuth();
  const selectedDir = DIRECTIONS.find(d => d.id === direction);

  const handleSend = async () => {
    if (!direction) {
      setError('Выберите направление');
      return;
    }
    if (!subject.trim() || !text.trim()) {
      setError('Заполните тему и текст обращения');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createAppeal({
        direction,
        subject,
        text,
        isAnonymous: anon,
        authorId: anon ? null : user?.id ?? null,
      });
      setDirection('');
      setSubject('');
      setText('');
      setAnon(false);
      onClose();
      toast('Обращение отправлено');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Обратная связь и предложения"
      size="xl"
      footer={
        <>
          <label className="chk" style={{ flex: 1 }}>
            <input type="checkbox" checked={anon} onChange={e => setAnon(e.target.checked)} />
            Отправить анонимно
          </label>
          <button className="btn btn-secondary" onClick={onClose} disabled={saving}>Закрыть</button>
          <button className="btn btn-primary" onClick={handleSend} disabled={saving}>
            {saving ? 'Отправка...' : 'Отправить'}
          </button>
        </>
      }
    >
      <div className="grid-2">
        <div className="field">
          <label>Направление <span style={{ color: 'var(--err)' }}>*</span></label>
          <select className="sel" value={direction} onChange={e => setDirection(e.target.value)}>
            <option value="">Выберите направление</option>
            {DIRECTIONS.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
          </select>
          {selectedDir && (
            <div style={{
              padding: '10px 14px',
              background: 'var(--gpc-sky)',
              borderRadius: 8,
              marginTop: 8,
              display: 'flex',
              gap: 10,
              color: 'var(--gpc-blue-800)',
            }}>
              <Icon name="info" size={16} />
              <div style={{ fontSize: 12.5 }}>
                <b>{selectedDir.label}.</b> {selectedDir.hint}
              </div>
            </div>
          )}
        </div>
        <div className="field">
          <label>Автор</label>
          <div className="inp" style={{ display: 'flex', alignItems: 'center', background: 'var(--gpc-gray-50)' }}>
            {anon ? 'Анонимно' : (user ? `${user.lastName} ${user.firstName}` : '—')}
          </div>
        </div>
      </div>

      <div className="field" style={{ marginTop: 16 }}>
        <label>Тема <span style={{ color: 'var(--err)' }}>*</span></label>
        <input
          className="inp"
          value={subject}
          onChange={e => setSubject(e.target.value)}
          placeholder="Коротко о сути обращения"
        />
      </div>

      <div className="field" style={{ marginTop: 12 }}>
        <label>Текст обращения <span style={{ color: 'var(--err)' }}>*</span></label>
        <textarea
          className="ta"
          rows={5}
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Опишите подробно ваш вопрос или предложение..."
        />
      </div>

      <div className="dropzone" style={{ marginTop: 16 }}>
        <Icon name="upload" size={20} />
        <div>
          Перетащите файлы или <b style={{ color: 'var(--gpc-blue)' }}>выберите с диска</b>
        </div>
        <div style={{ fontSize: 11, color: 'var(--gpc-gray-400)' }}>
          Прикрепление файлов появится в следующей итерации (интеграция MinIO)
        </div>
      </div>

      {error && (
        <div className="pill pill-red" style={{ marginTop: 16, display: 'inline-flex' }}>{error}</div>
      )}
    </Modal>
  );
}
