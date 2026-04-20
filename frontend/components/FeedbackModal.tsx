'use client';

import React, { useState } from 'react';
import { Modal, Icon, useToast } from '@/components/primitives';

const DIRECTIONS = [
  { id: 'hr', label: 'HR и кадры', hint: 'Справки, трудовая, отпуска, ДМС' },
  { id: 'it', label: 'ИТ-поддержка', hint: 'Оборудование, доступы, аккаунты' },
  { id: 'admin', label: 'АХО и офис', hint: 'Пропуска, офисное пространство' },
  { id: 'finance', label: 'Финансы и ЗП', hint: 'Расчётные листки, командировки' },
  { id: 'legal', label: 'Юридическая служба', hint: 'Договоры, NDA, правовые вопросы' },
  { id: 'security', label: 'Служба безопасности', hint: 'Пропуска, информационная безопасность' },
];

interface FeedbackModalProps {
  open: boolean;
  onClose: () => void;
}

export function FeedbackModal({ open, onClose }: FeedbackModalProps) {
  const [dir, setDir] = useState('');
  const [anon, setAnon] = useState(false);
  const [wantReply, setWantReply] = useState(true);
  const toast = useToast();
  const selectedDir = DIRECTIONS.find(d => d.id === dir);

  const handleSend = () => {
    onClose();
    toast('Обращение отправлено');
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
          <label className="chk" style={{ marginRight: 12 }}>
            <input type="checkbox" checked={wantReply} onChange={e => setWantReply(e.target.checked)} />
            Хочу получить ответ
          </label>
          <button className="btn btn-secondary" onClick={onClose}>Закрыть</button>
          <button className="btn btn-primary" onClick={handleSend}>Отправить</button>
        </>
      }
    >
      <div className="grid-2">
        <div className="field">
          <label>Направление <span style={{ color: 'var(--err)' }}>*</span></label>
          <select className="sel" value={dir} onChange={e => setDir(e.target.value)}>
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
          <label>Подразделение</label>
          <select className="sel" defaultValue="it">
            <option value="it">Блок ИТ / Отдел разработки</option>
            <option value="qa">Блок ИТ / Отдел тестирования</option>
            <option value="cap">Блок капитального строительства</option>
            <option value="hr">HR-департамент</option>
          </select>
        </div>
      </div>

      <div style={{ marginTop: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <h4 style={{ fontFamily: 'var(--font-head)', fontSize: 17 }}>Вопросы</h4>
          <button className="btn btn-ghost btn-sm">
            <Icon name="plus" size={14} /> Добавить вопрос
          </button>
        </div>

        <div className="card" style={{ padding: 16, marginBottom: 10 }}>
          <div className="field">
            <label>Вопрос 1</label>
            <input className="inp" defaultValue="Опишите ваш вопрос или предложение" />
          </div>
          <div className="field" style={{ marginTop: 12 }}>
            <textarea className="ta" rows={3} placeholder="Текст вашего ответа..." />
          </div>
        </div>

        <div className="dropzone">
          <Icon name="upload" size={20} />
          <div>
            Перетащите файлы или <b style={{ color: 'var(--gpc-blue)' }}>выберите с диска</b>
          </div>
          <div style={{ fontSize: 11, color: 'var(--gpc-gray-400)' }}>
            PDF, DOCX, JPG · до 10 МБ
          </div>
        </div>
      </div>
    </Modal>
  );
}
