'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Icon, Modal, useToast } from '@/components/primitives';
import {
  KnowledgeDoc, KnowledgeList, ReportPromptView,
  getKnowledgeDocs, uploadKnowledgeDoc, getKnowledgeDocText,
  updateKnowledgeDoc, deleteKnowledgeDoc, getReportPrompt, saveReportPrompt,
} from '@/lib/api';

const fmtChars = (n: number) => n.toLocaleString('ru-RU');

export function MethodDocsTab() {
  return (
    <div className="stack-3" style={{ maxWidth: 960 }}>
      <DocsSection />
    </div>
  );
}

export function SettingsTab() {
  return (
    <div className="stack-3" style={{ maxWidth: 960 }}>
      <PromptSection />
    </div>
  );
}

// ─── Методические документы ───────────────────────────

function DocsSection() {
  const toast = useToast();
  const [list, setList] = useState<KnowledgeList | null>(null);
  const [uploading, setUploading] = useState(false);
  const [viewDoc, setViewDoc] = useState<{ name: string; text: string } | null>(null);
  const [delTarget, setDelTarget] = useState<KnowledgeDoc | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try { setList(await getKnowledgeDocs()); } catch (e) { toast((e as Error).message); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setUploading(true);
    try {
      await uploadKnowledgeDoc(f);
      toast('Документ загружен');
      load();
    } catch (e) { toast((e as Error).message); } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const toggle = async (d: KnowledgeDoc) => {
    try { await updateKnowledgeDoc(d.id, { isActive: !d.isActive }); load(); }
    catch (e) { toast((e as Error).message); }
  };

  const view = async (d: KnowledgeDoc) => {
    try { const t = await getKnowledgeDocText(d.id); setViewDoc({ name: t.name, text: t.text }); }
    catch (e) { toast((e as Error).message); }
  };

  const remove = async () => {
    if (!delTarget) return;
    try { await deleteKnowledgeDoc(delTarget.id); setDelTarget(null); toast('Документ удалён'); load(); }
    catch (e) { toast((e as Error).message); }
  };

  if (!list) return <div className="card card-pad muted">Загрузка...</div>;

  const overLimit = list.activeChars > list.maxContextChars;

  return (
    <div className="card card-pad">
      <div className="card-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <b>Методические документы</b>
          <div className="small muted">Используются моделью при автогенерации отчётов (текст документов добавляется в контекст)</div>
        </div>
        <label className={`btn btn-secondary btn-sm ${uploading ? 'disabled' : ''}`} style={{ cursor: 'pointer' }}>
          <Icon name="upload" size={13} /> {uploading ? 'Загрузка...' : 'Загрузить документ'}
          <input ref={fileRef} type="file" accept=".docx,.txt,.md" style={{ display: 'none' }}
            disabled={uploading} onChange={e => onFile(e.target.files?.[0])} />
        </label>
      </div>

      {list.docs.length === 0 && (
        <div className="muted small" style={{ marginTop: 12 }}>
          Документов пока нет. Загрузите методику интерпретации (.docx, .txt или .md) — модель будет опираться на неё при генерации отчётов.
        </div>
      )}

      {list.docs.map(d => (
        <div key={d.id} className="row-2" style={{ alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderTop: '1px solid var(--line)', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ minWidth: 240 }}>
            <b>{d.name}</b>
            <div className="small muted">{fmtChars(d.charCount)} симв. · загружен {new Date(d.createdAt).toLocaleDateString('ru-RU')}</div>
          </div>
          <div className="row-2" style={{ alignItems: 'center', gap: 10 }}>
            <label className="chk" title="Подставлять документ в промт при генерации">
              <input type="checkbox" checked={d.isActive} onChange={() => toggle(d)} />
              <span className="small">использовать при генерации</span>
            </label>
            <button className="btn btn-ghost btn-sm" title="Просмотр текста" onClick={() => view(d)}><Icon name="search" size={13} /></button>
            <button className="btn btn-ghost btn-sm" title="Удалить" onClick={() => setDelTarget(d)}><Icon name="trash" size={13} /></button>
          </div>
        </div>
      ))}

      <div className="small" style={{ marginTop: 10, color: overLimit ? 'var(--err)' : 'var(--gpc-gray-500)' }}>
        Активных документов: {fmtChars(list.activeChars)} из {fmtChars(list.maxContextChars)} симв.
        {overLimit && ' — лимит превышен, при генерации текст будет обрезан. Отключите часть документов.'}
      </div>

      {viewDoc && (
        <Modal open onClose={() => setViewDoc(null)} title={viewDoc.name} size="lg">
          <div style={{ whiteSpace: 'pre-wrap', maxHeight: '60vh', overflowY: 'auto', fontSize: 13 }}>{viewDoc.text}</div>
        </Modal>
      )}

      <Modal open={!!delTarget} onClose={() => setDelTarget(null)} title="Удаление документа" footer={
        <><button className="btn btn-secondary" onClick={() => setDelTarget(null)}>Отмена</button>
        <button className="btn btn-primary" style={{ background: 'var(--err)' }} onClick={remove}>Удалить</button></>
      }>
        <p>Удалить документ <b>{delTarget?.name}</b> из базы знаний? Он перестанет использоваться при генерации отчётов.</p>
      </Modal>
    </div>
  );
}

// ─── Системный промт ───────────────────────────────────

function PromptSection() {
  const toast = useToast();
  const [view, setView] = useState<ReportPromptView | null>(null);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [showTech, setShowTech] = useState(false);

  const load = useCallback(async () => {
    try {
      const v = await getReportPrompt();
      setView(v);
      setText(v.text ?? v.defaultText);
    } catch (e) { toast((e as Error).message); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      const v = await saveReportPrompt(text.trim() || null);
      setView(v);
      setText(v.text ?? v.defaultText);
      toast(v.isCustom ? 'Промт сохранён' : 'Промт совпал со стандартным — используется стандартный');
    } catch (e) { toast((e as Error).message); } finally { setSaving(false); }
  };

  const reset = async () => {
    setConfirmReset(false);
    setSaving(true);
    try {
      const v = await saveReportPrompt(null);
      setView(v);
      setText(v.defaultText);
      toast('Возвращён стандартный промт');
    } catch (e) { toast((e as Error).message); } finally { setSaving(false); }
  };

  if (!view) return <div className="card card-pad muted">Загрузка...</div>;

  return (
    <div className="card card-pad stack-3">
      <div className="row-2" style={{ alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <b>Системный промт</b>
          <div className="small muted">Методическая часть инструкции для модели — как интерпретировать результаты оценки</div>
        </div>
        <span className={`pill ${view.isCustom ? 'pill-yellow' : 'pill-green'}`}>{view.isCustom ? 'Изменён' : 'Стандартный'}</span>
      </div>

      <textarea className="ta" rows={16} value={text} onChange={e => setText(e.target.value)}
        style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12.5, lineHeight: 1.5 }} />

      <div className="small muted">
        Плейсхолдеры: {'{{scale_min}}'} и {'{{scale_max}}'} — границы шкалы, {'{{target_level}}'} — целевой уровень цикла;
        подставляются автоматически при генерации. Активные документы базы знаний добавляются к промту.
      </div>

      <div className="row-2" style={{ gap: 8, flexWrap: 'wrap' }}>
        <button className="btn btn-primary btn-sm" disabled={saving} onClick={save}>{saving ? 'Сохранение...' : 'Сохранить'}</button>
        {view.isCustom && <button className="btn btn-secondary btn-sm" disabled={saving} onClick={() => setConfirmReset(true)}>Сбросить к стандартному</button>}
        <button className="btn btn-ghost btn-sm" onClick={() => setShowTech(s => !s)}>
          Технический промт
        </button>
      </div>

      {showTech && (
        <div style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 12, background: 'var(--gpc-gray-50)' }}>
          <div className="small muted" style={{ marginBottom: 6 }}>
            Технический промт добавляется автоматически и не редактируется — он задаёт формат ответа модели (JSON-схему отчёта).
          </div>
          <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'ui-monospace, monospace', fontSize: 12, maxHeight: 260, overflowY: 'auto' }}>{view.technicalText}</div>
        </div>
      )}

      <Modal open={confirmReset} onClose={() => setConfirmReset(false)} title="Сбросить промт?" footer={
        <><button className="btn btn-secondary" onClick={() => setConfirmReset(false)}>Отмена</button>
        <button className="btn btn-primary" onClick={reset}>Сбросить</button></>
      }>
        <p>Ваши правки методической части будут удалены, вернётся стандартный промт. Продолжить?</p>
      </Modal>
    </div>
  );
}
