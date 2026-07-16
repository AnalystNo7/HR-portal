'use client';

import React, { useEffect, useState } from 'react';
import { useToast } from '@/components/primitives';
import {
  LlmSettingsView, getLlmSettings, saveLlmSettings, testLlmConnection,
} from '@/lib/api';

const SOURCE_LABEL: Record<LlmSettingsView['source'], string> = {
  db: 'настройки из панели администратора',
  env: 'настройки из переменных окружения',
  none: 'подключение не настроено',
};

export default function AdminLlmPage() {
  const toast = useToast();
  const [view, setView] = useState<LlmSettingsView | null>(null);
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [temperature, setTemperature] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const load = async () => {
    try {
      const v = await getLlmSettings();
      setView(v);
      setBaseUrl(v.baseUrl);
      setModel(v.model);
      setTemperature(v.temperature != null ? String(v.temperature) : '');
      setApiKey('');
    } catch (e) { toast((e as Error).message); }
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const dto = () => {
    const t = temperature.trim();
    return {
      baseUrl: baseUrl.trim() || null,
      model: model.trim() || null,
      // пустой ключ не отправляем — сохранённый останется
      apiKey: apiKey.trim() ? apiKey.trim() : undefined,
      temperature: t === '' ? null : Number(t.replace(',', '.')),
    };
  };

  const save = async () => {
    const d = dto();
    if (d.temperature != null && !Number.isFinite(d.temperature)) { toast('Температура — число, например 0.3'); return; }
    setSaving(true);
    try {
      const v = await saveLlmSettings(d);
      setView(v);
      setApiKey('');
      toast('Настройки сохранены');
    } catch (e) { toast((e as Error).message); } finally { setSaving(false); }
  };

  const test = async () => {
    setTesting(true);
    try {
      const r = await testLlmConnection(dto());
      toast(r.ok ? 'Подключение успешно' : `Ошибка подключения: ${r.error ?? 'неизвестно'}`);
    } catch (e) { toast((e as Error).message); } finally { setTesting(false); }
  };

  if (!view) return <div className="card card-pad muted">Загрузка...</div>;

  return (
    <div style={{ maxWidth: 640 }}>
      <h2 style={{ fontFamily: 'var(--font-head)', fontSize: 22, marginBottom: 8 }}>Генерация отчётов (ИИ)</h2>
      <p className="small muted" style={{ marginBottom: 16 }}>
        Подключение к модели для генерации интерпретации отчётов оценки 360.
        Совместимо с OpenAI-подобным API (OpenAI, DeepSeek, локальные vLLM/Ollama и т.п.).
      </p>

      <div className="card card-pad stack-3">
        <div className="row-2" style={{ alignItems: 'center', gap: 8 }}>
          <span className={`pill ${view.configured ? 'pill-green' : 'pill-gray'}`}>
            {view.configured ? 'Настроено' : 'Не настроено'}
          </span>
          <span className="small muted">{SOURCE_LABEL[view.source]}</span>
        </div>

        <div className="field">
          <label className="small">Адрес API (base URL)</label>
          <input className="inp" value={baseUrl} placeholder="https://api.openai.com/v1"
            onChange={e => setBaseUrl(e.target.value)} />
        </div>

        <div className="field">
          <label className="small">API-ключ</label>
          <input className="inp" type="password"
            value={apiKey}
            placeholder={view.apiKeySet ? `Сохранён (${view.apiKeyMasked}) — оставьте пустым, чтобы не менять` : 'Введите ключ'}
            onChange={e => setApiKey(e.target.value)} />
        </div>

        <div className="field">
          <label className="small">Модель</label>
          <input className="inp" value={model} placeholder="gpt-4o"
            onChange={e => setModel(e.target.value)} />
        </div>

        <div className="field">
          <label className="small">Температура (необязательно, по умолчанию 0.3)</label>
          <input className="inp" type="number" step={0.1} min={0} max={2} value={temperature}
            placeholder="0.3" onChange={e => setTemperature(e.target.value)} />
        </div>

        <div className="row-2" style={{ gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" disabled={saving} onClick={save}>
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
          <button className="btn btn-secondary" disabled={testing} onClick={test}>
            {testing ? 'Проверка...' : 'Проверить подключение'}
          </button>
        </div>

        <div className="small muted">
          Ключ хранится в базе данных и в интерфейсе показывается только маской.
          Если оставить настройки пустыми, используются переменные окружения (LLM_BASE_URL и др.).
        </div>
      </div>
    </div>
  );
}
