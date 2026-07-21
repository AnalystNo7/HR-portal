'use client';

import React, { useEffect, useState } from 'react';
import { Modal, useToast } from '@/components/primitives';
import {
  LlmPreset, LlmPresetList, SaveLlmDto,
  getLlmPresets, createLlmPreset, updateLlmPreset, activateLlmPreset, deleteLlmPreset, testLlmConnection,
} from '@/lib/api';

const SOURCE_LABEL: Record<LlmPresetList['source'], string> = {
  db: 'Генерация использует активную настройку',
  env: 'Генерация использует переменные окружения (активной настройки нет)',
  none: 'Подключение не настроено — генерация недоступна',
};

export default function AdminLlmPage() {
  const toast = useToast();
  const [list, setList] = useState<LlmPresetList | null>(null);
  const [busy, setBusy] = useState<string | null>(null); // id пресета или 'new'
  const [editTarget, setEditTarget] = useState<LlmPreset | 'new' | null>(null);
  const [delTarget, setDelTarget] = useState<LlmPreset | null>(null);

  const load = async () => {
    try { setList(await getLlmPresets()); } catch (e) { toast((e as Error).message); }
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const activate = async (p: LlmPreset) => {
    setBusy(p.id);
    try { setList(await activateLlmPreset(p.id)); toast(`Активная настройка: ${p.name}`); }
    catch (e) { toast((e as Error).message); } finally { setBusy(null); }
  };

  const remove = async () => {
    if (!delTarget) return;
    setBusy(delTarget.id);
    try { setList(await deleteLlmPreset(delTarget.id)); toast('Настройка удалена'); setDelTarget(null); }
    catch (e) { toast((e as Error).message); } finally { setBusy(null); }
  };

  if (!list) return <div className="card card-pad muted">Загрузка...</div>;

  return (
    <div style={{ maxWidth: 720 }}>
      <h2 style={{ fontFamily: 'var(--font-head)', fontSize: 22, marginBottom: 8 }}>Настройка LLM</h2>
      <p className="small muted" style={{ marginBottom: 16 }}>
        Именованные настройки подключения к модели для генерации отчётов 360.
        Активная настройка используется при генерации; переключение — без редеплоя.
        Совместимо с OpenAI-подобным API (OpenAI, DeepSeek, локальные vLLM/Ollama, прокси и т.п.).
      </p>

      <div className="card card-pad stack-3">
        <div className="row-2" style={{ alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <span className="small muted">{SOURCE_LABEL[list.source]}</span>
          <button className="btn btn-primary btn-sm" onClick={() => setEditTarget('new')}>Добавить настройку</button>
        </div>

        {list.presets.length === 0 && (
          <div className="small muted">Настроек пока нет — добавьте первую, она станет активной.</div>
        )}

        {list.presets.map(p => (
          <div key={p.id} className="row-2" style={{ alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderTop: '1px solid var(--line)', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ minWidth: 220 }}>
              <div className="row-2" style={{ alignItems: 'center', gap: 8 }}>
                <b>{p.name}</b>
                {p.isActive && <span className="pill pill-green">Активная</span>}
              </div>
              <div className="small muted">
                {p.model || 'модель не указана'}{p.baseUrl ? ` · ${p.baseUrl}` : ''}{p.apiKeySet ? ` · ключ ${p.apiKeyMasked}` : ' · ключ не задан'}{p.maxTokens != null ? ` · лимит ${p.maxTokens}` : ''}{p.splitParts != null && p.splitParts > 1 ? ` · ${p.splitParts} запроса` : ''}
              </div>
            </div>
            <div className="row-2" style={{ gap: 6, flexWrap: 'wrap' }}>
              {!p.isActive && (
                <button className="btn btn-secondary btn-sm" disabled={busy != null} onClick={() => activate(p)}>
                  {busy === p.id ? '...' : 'Сделать активной'}
                </button>
              )}
              <button className="btn btn-ghost btn-sm" disabled={busy != null} onClick={() => setEditTarget(p)}>Редактировать</button>
              {!p.isActive && (
                <button className="btn btn-ghost btn-sm" style={{ color: 'var(--err)' }} disabled={busy != null} onClick={() => setDelTarget(p)}>Удалить</button>
              )}
            </div>
          </div>
        ))}

        <div className="small muted">
          Ключи хранятся в базе данных и показываются только маской. Переменные окружения LLM_* работают
          как запасной вариант, когда нет активной настройки.
        </div>
      </div>

      {editTarget && (
        <PresetModal
          preset={editTarget === 'new' ? null : editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={l => { setList(l); setEditTarget(null); }}
        />
      )}

      <Modal open={!!delTarget} onClose={() => setDelTarget(null)} title="Удаление настройки" footer={
        <><button className="btn btn-secondary" onClick={() => setDelTarget(null)}>Отмена</button>
        <button className="btn btn-primary" style={{ background: 'var(--err)' }} disabled={busy != null} onClick={remove}>Удалить</button></>
      }>
        <p>Удалить настройку <b>{delTarget?.name}</b>? Сохранённый в ней ключ будет удалён из базы.</p>
      </Modal>
    </div>
  );
}

/** Форма создания/правки пресета + проверка подключения. */
function PresetModal({ preset, onClose, onSaved }: {
  preset: LlmPreset | null;
  onClose: () => void;
  onSaved: (l: LlmPresetList) => void;
}) {
  const toast = useToast();
  const [name, setName] = useState(preset?.name ?? '');
  const [baseUrl, setBaseUrl] = useState(preset?.baseUrl ?? '');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState(preset?.model ?? '');
  const [temperature, setTemperature] = useState(preset?.temperature != null ? String(preset.temperature) : '');
  // по умолчанию лимит НЕ отправляется (провайдер сам решает); галочка открывает поле
  const [limitEnabled, setLimitEnabled] = useState(preset?.maxTokens != null);
  const [maxTokens, setMaxTokens] = useState(preset?.maxTokens != null ? String(preset.maxTokens) : '');
  // генерация по частям: каждой части — свой лимит вывода (обход потолка провайдера)
  const [splitParts, setSplitParts] = useState(String(preset?.splitParts ?? 1));
  // таймауты попыток по частям (сек), по полю на запрос; '' = дефолт 300
  const [partTimeouts, setPartTimeouts] = useState<string[]>([0, 1, 2].map(i => {
    const v = preset?.partTimeouts?.[i];
    return v != null ? String(v) : '';
  }));
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const dto = (): SaveLlmDto => {
    const t = temperature.trim();
    const mt = maxTokens.trim();
    return {
      name: name.trim() || null,
      baseUrl: baseUrl.trim() || null,
      model: model.trim() || null,
      apiKey: apiKey.trim() ? apiKey.trim() : undefined, // пусто — не менять сохранённый
      temperature: t === '' ? null : Number(t.replace(',', '.')),
      maxTokens: limitEnabled && mt !== '' ? Number(mt) : null,
      splitParts: Number(splitParts) || 1,
      // только видимые поля (по числу запросов); '' → null (дефолт 300)
      partTimeouts: partTimeouts
        .slice(0, Number(splitParts) || 1)
        .map(t => (t.trim() === '' ? null : Number(t))),
      ...(preset ? { presetId: preset.id } : {}),
    };
  };

  const save = async () => {
    const d = dto();
    if (!d.name) { toast('Укажите название настройки'); return; }
    if (d.temperature != null && !Number.isFinite(d.temperature)) { toast('Температура — число, например 0.3'); return; }
    if (limitEnabled && maxTokens.trim() === '') { toast('Укажите лимит токенов или снимите галочку'); return; }
    if (d.maxTokens != null && !Number.isFinite(d.maxTokens)) { toast('Лимит токенов — целое число, например 16384'); return; }
    if (d.partTimeouts?.some(t => t != null && (!Number.isInteger(t) || t < 30 || t > 600))) { toast('Таймаут запроса — от 30 до 600 секунд'); return; }
    setSaving(true);
    try {
      const l = preset ? await updateLlmPreset(preset.id, d) : await createLlmPreset(d);
      toast('Настройка сохранена');
      onSaved(l);
    } catch (e) { toast((e as Error).message); } finally { setSaving(false); }
  };

  const test = async () => {
    setTesting(true);
    try {
      const r = await testLlmConnection(dto());
      toast(r.ok ? 'Подключение успешно' : `Ошибка подключения: ${r.error ?? 'неизвестно'}`);
    } catch (e) { toast((e as Error).message); } finally { setTesting(false); }
  };

  return (
    <Modal open onClose={onClose} title={preset ? `Настройка: ${preset.name}` : 'Новая настройка LLM'} footer={
      <><button className="btn btn-secondary" onClick={onClose}>Отмена</button>
      <button className="btn btn-secondary" disabled={testing} onClick={test}>{testing ? 'Проверка...' : 'Проверить подключение'}</button>
      <button className="btn btn-primary" disabled={saving} onClick={save}>{saving ? 'Сохранение...' : 'Сохранить'}</button></>
    }>
      <div className="stack-3">
        <div className="field">
          <label className="small">Название</label>
          <input className="inp" value={name} placeholder="Например: Gonka MiniMax / Прод Claude"
            onChange={e => setName(e.target.value)} autoFocus />
        </div>
        <div className="field">
          <label className="small">Адрес API (base URL)</label>
          <input className="inp" value={baseUrl} placeholder="https://api.proxy.gonka.gg/v1"
            onChange={e => setBaseUrl(e.target.value)} />
        </div>
        <div className="field">
          <label className="small">API-ключ</label>
          <input className="inp" type="password" value={apiKey}
            placeholder={preset?.apiKeySet ? `Сохранён (${preset.apiKeyMasked}) — оставьте пустым, чтобы не менять` : 'Введите ключ'}
            onChange={e => setApiKey(e.target.value)} />
        </div>
        <div className="field">
          <label className="small">Модель</label>
          <input className="inp" value={model} placeholder="MiniMaxAI/MiniMax-M2.7"
            onChange={e => setModel(e.target.value)} />
        </div>
        <div className="field">
          <label className="small">Температура (необязательно, по умолчанию 0.3)</label>
          <input className="inp" type="number" step={0.1} min={0} max={2} value={temperature}
            placeholder="0.3" onChange={e => setTemperature(e.target.value)} />
        </div>
        <div className="field">
          <label className="small" style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={limitEnabled} onChange={e => setLimitEnabled(e.target.checked)} />
            Ограничить размер ответа
          </label>
          {limitEnabled && (
            <input className="inp" type="number" step={1} min={256} max={128000} value={maxTokens}
              placeholder="Например 16384" onChange={e => setMaxTokens(e.target.value)} />
          )}
        </div>
        <div className="field">
          <label className="small">Генерация отчёта</label>
          <select className="inp" value={splitParts} onChange={e => setSplitParts(e.target.value)}>
            <option value="1">Одним запросом</option>
            <option value="2">2 запроса</option>
            <option value="3">3 запроса</option>
          </select>
          <div className="small muted">
            По частям — когда отчёт не помещается в лимит вывода провайдера: каждая часть получает свой лимит.
          </div>
        </div>
        {Array.from({ length: Number(splitParts) || 1 }, (_, i) => (
          <div className="field" key={i}>
            <label className="small">
              {(Number(splitParts) || 1) === 1
                ? 'Таймаут запроса, сек (по умолчанию 300, диапазон 30–600)'
                : `Таймаут запроса ${i + 1}, сек (по умолчанию 300, диапазон 30–600)`}
            </label>
            <input className="inp" type="number" step={1} min={30} max={600} value={partTimeouts[i] ?? ''}
              placeholder="300" onChange={e => setPartTimeouts(list => list.map((x, j) => j === i ? e.target.value : x))} />
          </div>
        ))}
      </div>
    </Modal>
  );
}
