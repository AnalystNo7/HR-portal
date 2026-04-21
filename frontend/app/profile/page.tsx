'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Icon, Modal, useToast } from '@/components/primitives';
import { PersonProfile, PeopleTalk, EmptyCube, Vacation } from '@/components/illustrations/Illustrations';
import { useAuth } from '@/contexts/AuthContext';
import {
  listWorkExperiences,
  createWorkExperience,
  updateWorkExperience,
  deleteWorkExperience,
  listEducations,
  createEducation,
  updateEducation,
  deleteEducation,
  WorkExperience,
  WorkExperienceInput,
  Education,
  EducationInput,
} from '@/lib/api';

type SubTab = 'profile' | 'comp' | 'review' | 'vacation' | 'requests';

const TABS: { id: SubTab; label: string }[] = [
  { id: 'profile', label: 'Профиль' },
  { id: 'comp', label: 'Компетенции' },
  { id: 'review', label: 'Оценка' },
  { id: 'vacation', label: 'Отпуск' },
  { id: 'requests', label: 'Обращения' },
];

export default function ProfilePage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<SubTab>('profile');
  const [vacOpen, setVacOpen] = useState(false);

  if (!user) {
    return <div className="card card-pad">Загрузка профиля...</div>;
  }

  const fullName = `${user.lastName} ${user.firstName} ${user.middleName ?? ''}`.trim();

  return (
    <div>
      <div className="tabs">
        {TABS.map(t => (
          <button key={t.id} aria-selected={tab === t.id} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>

      <div className="profile-head">
        <div
          className="photo av-blue"
          style={{ fontSize: 24, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          {(user.lastName[0] ?? '') + (user.firstName[0] ?? '')}
        </div>
        <div className="names">
          <h1>{fullName}</h1>
          <div className="role">{user.position} · {user.department} · ООО «Газпром ЦПС»</div>
          <div className="meta">
            <span>E-mail: <b>{user.email}</b></span>
            <span>Табельный: <b>{user.personnelNumber}</b></span>
            {user.hireDate && <span>С: <b>{new Date(user.hireDate).toLocaleDateString('ru-RU')}</b></span>}
          </div>
        </div>
      </div>

      {tab === 'profile' && <ProfileTab employeeId={user.id} />}
      {tab === 'comp' && <CompetenciesTab />}
      {tab === 'review' && <ReviewTab />}
      {tab === 'vacation' && <VacationTab onRequest={() => setVacOpen(true)} />}
      {tab === 'requests' && (
        <div className="card" style={{ marginTop: 16, padding: 40 }}>
          <div className="empty">
            <div className="ill"><EmptyCube w={100} /></div>
            <h3>Список обращений</h3>
            <p>Перейдите в раздел «Обращения» для работы со всеми вашими заявками.</p>
          </div>
        </div>
      )}

      <VacationModal open={vacOpen} onClose={() => setVacOpen(false)} />
    </div>
  );
}

function Section({ title, children, onAdd }: { title: string; children: React.ReactNode; onAdd?: () => void }) {
  return (
    <div className="profile-section">
      <header>
        <h3>{title}</h3>
        {onAdd && (
          <button onClick={onAdd}>
            <Icon name="plus" size={14} /> Добавить
          </button>
        )}
      </header>
      <div className="ps-body">{children}</div>
    </div>
  );
}

function ProfileTab({ employeeId }: { employeeId: string }) {
  const [experiences, setExperiences] = useState<WorkExperience[]>([]);
  const [educations, setEducations] = useState<Education[]>([]);
  const [loadingExp, setLoadingExp] = useState(true);
  const [loadingEdu, setLoadingEdu] = useState(true);
  const [errorExp, setErrorExp] = useState<string | null>(null);
  const [errorEdu, setErrorEdu] = useState<string | null>(null);

  const [wxModal, setWxModal] = useState<{ mode: 'create' | 'edit'; item?: WorkExperience } | null>(null);
  const [eduModal, setEduModal] = useState<{ mode: 'create' | 'edit'; item?: Education } | null>(null);

  const toast = useToast();

  const loadExp = useCallback(async () => {
    setLoadingExp(true);
    setErrorExp(null);
    try {
      setExperiences(await listWorkExperiences(employeeId));
    } catch (e) {
      setErrorExp((e as Error).message);
    } finally {
      setLoadingExp(false);
    }
  }, [employeeId]);

  const loadEdu = useCallback(async () => {
    setLoadingEdu(true);
    setErrorEdu(null);
    try {
      setEducations(await listEducations(employeeId));
    } catch (e) {
      setErrorEdu((e as Error).message);
    } finally {
      setLoadingEdu(false);
    }
  }, [employeeId]);

  useEffect(() => { loadExp(); loadEdu(); }, [loadExp, loadEdu]);

  const handleDeleteExp = async (id: string) => {
    if (!confirm('Удалить запись об опыте работы?')) return;
    try {
      await deleteWorkExperience(employeeId, id);
      toast('Удалено');
      loadExp();
    } catch (e) {
      toast(`Ошибка: ${(e as Error).message}`);
    }
  };

  const handleDeleteEdu = async (id: string) => {
    if (!confirm('Удалить запись об образовании?')) return;
    try {
      await deleteEducation(employeeId, id);
      toast('Удалено');
      loadEdu();
    } catch (e) {
      toast(`Ошибка: ${(e as Error).message}`);
    }
  };

  return (
    <div>
      <div className="profile-callouts">
        <div className="banner">
          <div className="ill"><PersonProfile w={160} /></div>
          <div className="b-body">
            <h3>Заполните профиль полностью</h3>
            <p>Полный профиль помогает коллегам найти вас по навыкам, а HR — подобрать релевантные проекты и обучение.</p>
          </div>
        </div>
        <div className="banner warm">
          <div className="ill"><PeopleTalk w={160} /></div>
          <div className="b-body">
            <h3>Матрица компетенций</h3>
            <p>Оцените свои навыки и посмотрите уровень владения коллег. Модуль в разработке — доступен с III квартала.</p>
            <button className="btn btn-secondary btn-sm" style={{ marginTop: 10 }}>Подробнее →</button>
          </div>
        </div>
      </div>

      <Section title="Опыт работы" onAdd={() => setWxModal({ mode: 'create' })}>
        {loadingExp && <div className="muted small">Загрузка...</div>}
        {errorExp && <div className="pill pill-red">Ошибка: {errorExp}</div>}
        {!loadingExp && experiences.length === 0 && !errorExp && (
          <div className="empty">
            <div className="ill"><EmptyCube w={80} /></div>
            <h3>Опыт работы ещё не добавлен</h3>
            <p style={{ fontSize: 12.5 }}>Расскажите о предыдущих местах работы и проектах.</p>
          </div>
        )}
        {experiences.map(exp => (
          <div key={exp.id} className="item-row">
            <div className="time">
              {formatDate(exp.startDate)} – {exp.isCurrent ? 'настоящее' : formatDate(exp.endDate)}
            </div>
            <div className="body">
              <b>{exp.company} · {exp.position}</b>
              {exp.description && <p>{exp.description}</p>}
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setWxModal({ mode: 'edit', item: exp })}>
                <Icon name="edit" size={14} />
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => handleDeleteExp(exp.id)}>
                <Icon name="trash" size={14} />
              </button>
            </div>
          </div>
        ))}
      </Section>

      <Section title="Образование" onAdd={() => setEduModal({ mode: 'create' })}>
        {loadingEdu && <div className="muted small">Загрузка...</div>}
        {errorEdu && <div className="pill pill-red">Ошибка: {errorEdu}</div>}
        {!loadingEdu && educations.length === 0 && !errorEdu && (
          <div className="empty">
            <div className="ill"><EmptyCube w={80} /></div>
            <h3>Образование ещё не добавлено</h3>
            <p style={{ fontSize: 12.5 }}>Добавьте учебные заведения и курсы.</p>
          </div>
        )}
        {educations.map(edu => (
          <div key={edu.id} className="item-row">
            <div className="time">{edu.yearCompleted ?? '—'}</div>
            <div className="body">
              <b>{edu.institution}{edu.specialization ? ` · ${edu.specialization}` : ''}</b>
              <p>{edu.level}{edu.type === 'ADDITIONAL' ? ' · доп. образование' : ''}</p>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setEduModal({ mode: 'edit', item: edu })}>
                <Icon name="edit" size={14} />
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => handleDeleteEdu(edu.id)}>
                <Icon name="trash" size={14} />
              </button>
            </div>
          </div>
        ))}
      </Section>

      <WorkExperienceModal
        state={wxModal}
        employeeId={employeeId}
        onClose={() => setWxModal(null)}
        onSaved={() => { setWxModal(null); loadExp(); toast('Сохранено'); }}
      />

      <EducationModal
        state={eduModal}
        employeeId={employeeId}
        onClose={() => setEduModal(null)}
        onSaved={() => { setEduModal(null); loadEdu(); toast('Сохранено'); }}
      />
    </div>
  );
}

function formatDate(date: string | null | undefined) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('ru-RU', { year: 'numeric', month: 'short' });
}

function toInputDate(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Date(iso).toISOString().slice(0, 10);
}

function WorkExperienceModal({
  state,
  employeeId,
  onClose,
  onSaved,
}: {
  state: { mode: 'create' | 'edit'; item?: WorkExperience } | null;
  employeeId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<WorkExperienceInput>({ company: '', position: '', startDate: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (state?.mode === 'edit' && state.item) {
      setForm({
        company: state.item.company,
        position: state.item.position,
        startDate: toInputDate(state.item.startDate),
        endDate: toInputDate(state.item.endDate),
        isCurrent: state.item.isCurrent,
        description: state.item.description ?? '',
      });
    } else if (state?.mode === 'create') {
      setForm({ company: '', position: '', startDate: '', endDate: '', isCurrent: false, description: '' });
    }
    setError(null);
  }, [state]);

  const handleSave = async () => {
    if (!form.company.trim() || !form.position.trim() || !form.startDate) {
      setError('Заполните обязательные поля');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload: WorkExperienceInput = {
        company: form.company,
        position: form.position,
        startDate: form.startDate,
        endDate: form.isCurrent ? null : (form.endDate || null),
        isCurrent: !!form.isCurrent,
        description: form.description || null,
      };
      if (state?.mode === 'edit' && state.item) {
        await updateWorkExperience(employeeId, state.item.id, payload);
      } else {
        await createWorkExperience(employeeId, payload);
      }
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={!!state}
      onClose={onClose}
      title={state?.mode === 'edit' ? 'Редактировать место работы' : 'Добавить место работы'}
      size="md"
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} disabled={saving}>Отмена</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </>
      }
    >
      <div className="field">
        <label>Компания *</label>
        <input className="inp" value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} />
      </div>
      <div className="field" style={{ marginTop: 12 }}>
        <label>Должность *</label>
        <input className="inp" value={form.position} onChange={e => setForm({ ...form, position: e.target.value })} />
      </div>
      <div className="grid-2" style={{ marginTop: 12 }}>
        <div className="field">
          <label>Дата начала *</label>
          <input className="inp" type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} />
        </div>
        <div className="field">
          <label>Дата окончания</label>
          <input
            className="inp"
            type="date"
            value={form.endDate ?? ''}
            disabled={!!form.isCurrent}
            onChange={e => setForm({ ...form, endDate: e.target.value })}
          />
        </div>
      </div>
      <label className="chk" style={{ marginTop: 12 }}>
        <input
          type="checkbox"
          checked={!!form.isCurrent}
          onChange={e => setForm({ ...form, isCurrent: e.target.checked })}
        />
        По настоящее время
      </label>
      <div className="field" style={{ marginTop: 12 }}>
        <label>Описание</label>
        <textarea
          className="ta"
          rows={3}
          value={form.description ?? ''}
          onChange={e => setForm({ ...form, description: e.target.value })}
        />
      </div>
      {error && <div className="pill pill-red" style={{ marginTop: 12 }}>{error}</div>}
    </Modal>
  );
}

function EducationModal({
  state,
  employeeId,
  onClose,
  onSaved,
}: {
  state: { mode: 'create' | 'edit'; item?: Education } | null;
  employeeId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<EducationInput>({ institution: '', level: '', type: 'BASIC' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (state?.mode === 'edit' && state.item) {
      setForm({
        institution: state.item.institution,
        specialization: state.item.specialization ?? '',
        level: state.item.level,
        yearCompleted: state.item.yearCompleted,
        type: state.item.type,
      });
    } else if (state?.mode === 'create') {
      setForm({ institution: '', specialization: '', level: '', yearCompleted: null, type: 'BASIC' });
    }
    setError(null);
  }, [state]);

  const handleSave = async () => {
    if (!form.institution.trim() || !form.level.trim()) {
      setError('Заполните обязательные поля');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload: EducationInput = {
        institution: form.institution,
        specialization: form.specialization || null,
        level: form.level,
        yearCompleted: form.yearCompleted || null,
        type: form.type ?? 'BASIC',
      };
      if (state?.mode === 'edit' && state.item) {
        await updateEducation(employeeId, state.item.id, payload);
      } else {
        await createEducation(employeeId, payload);
      }
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={!!state}
      onClose={onClose}
      title={state?.mode === 'edit' ? 'Редактировать образование' : 'Добавить образование'}
      size="md"
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} disabled={saving}>Отмена</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </>
      }
    >
      <div className="field">
        <label>Учебное заведение *</label>
        <input className="inp" value={form.institution} onChange={e => setForm({ ...form, institution: e.target.value })} />
      </div>
      <div className="field" style={{ marginTop: 12 }}>
        <label>Специальность</label>
        <input
          className="inp"
          value={form.specialization ?? ''}
          onChange={e => setForm({ ...form, specialization: e.target.value })}
        />
      </div>
      <div className="grid-2" style={{ marginTop: 12 }}>
        <div className="field">
          <label>Уровень *</label>
          <input
            className="inp"
            placeholder="Бакалавр / Магистр / Курсы..."
            value={form.level}
            onChange={e => setForm({ ...form, level: e.target.value })}
          />
        </div>
        <div className="field">
          <label>Год окончания</label>
          <input
            className="inp"
            type="number"
            placeholder="2023"
            value={form.yearCompleted ?? ''}
            onChange={e => setForm({ ...form, yearCompleted: e.target.value ? Number(e.target.value) : null })}
          />
        </div>
      </div>
      <div className="field" style={{ marginTop: 12 }}>
        <label>Тип</label>
        <select
          className="sel"
          value={form.type}
          onChange={e => setForm({ ...form, type: e.target.value as EducationInput['type'] })}
        >
          <option value="BASIC">Основное</option>
          <option value="ADDITIONAL">Дополнительное</option>
        </select>
      </div>
      {error && <div className="pill pill-red" style={{ marginTop: 12 }}>{error}</div>}
    </Modal>
  );
}

function CompetenciesTab() {
  return (
    <div className="card" style={{ marginTop: 16, padding: 40 }}>
      <div className="empty">
        <div className="ill"><EmptyCube w={120} /></div>
        <h3 style={{ fontFamily: 'var(--font-head)', fontSize: 22, color: 'var(--gpc-blue-800)' }}>
          Матрица компетенций
        </h3>
        <p style={{ maxWidth: 480, margin: '8px auto' }}>
          Модуль самооценки по семьям ролей и уровням. Запуск — III квартал 2025.
        </p>
      </div>
    </div>
  );
}

function ReviewTab() {
  return (
    <div className="card" style={{ marginTop: 16, padding: 40 }}>
      <div className="empty">
        <div className="ill"><EmptyCube w={100} /></div>
        <h3>Период оценки ещё не начался</h3>
        <p style={{ maxWidth: 420, margin: '6px auto' }}>
          Следующая оценка — <b>октябрь 2025</b>. Руководитель получит уведомление за 2 недели до старта.
        </p>
      </div>
    </div>
  );
}

function VacationTab({ onRequest }: { onRequest: () => void }) {
  return (
    <div style={{ marginTop: 16 }}>
      <div className="banner warm">
        <div className="ill"><Vacation w={200} /></div>
        <div className="b-body">
          <h3>Остаток отпуска: 18 дней</h3>
          <p>14 дней основного отпуска и 4 дня накопленных с прошлого года.</p>
          <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
            <button className="btn btn-primary btn-sm" onClick={onRequest}>
              <Icon name="plus" size={14} /> Заявка на отпуск
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function VacationModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const [from, setFrom] = useState('2025-09-15');
  const [to, setTo] = useState('2025-09-26');
  const days = React.useMemo(() => {
    const d = (new Date(to).getTime() - new Date(from).getTime()) / 86400000 + 1;
    return isNaN(d) ? 0 : Math.max(0, Math.round(d));
  }, [from, to]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Заявка на отпуск"
      size="lg"
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Отмена</button>
          <button className="btn btn-primary" onClick={() => { onClose(); toast('Заявка отправлена руководителю'); }}>
            Отправить на согласование
          </button>
        </>
      }
    >
      <div className="grid-2">
        <div className="field">
          <label>Тип отпуска</label>
          <select className="sel" defaultValue="ann">
            <option value="ann">Ежегодный оплачиваемый</option>
            <option value="add">Дополнительный</option>
            <option value="own">За свой счёт</option>
          </select>
        </div>
        <div className="field">
          <label>Остаток</label>
          <div className="inp" style={{ display: 'flex', alignItems: 'center', background: 'var(--gpc-gray-50)' }}>
            <b style={{ color: 'var(--gpc-blue)' }}>18</b>&nbsp;дней доступно
          </div>
        </div>
        <div className="field">
          <label>С</label>
          <input className="inp" type="date" value={from} onChange={e => setFrom(e.target.value)} />
        </div>
        <div className="field">
          <label>По</label>
          <input className="inp" type="date" value={to} onChange={e => setTo(e.target.value)} />
        </div>
      </div>
      <div style={{
        marginTop: 16,
        padding: '10px 14px',
        background: 'var(--gpc-sky)',
        borderRadius: 8,
        display: 'flex',
        gap: 10,
        alignItems: 'center',
        color: 'var(--gpc-blue-800)',
        fontSize: 13,
      }}>
        <Icon name="info" size={18} />
        <div>Выбрано <b>{days} дней</b>. Остаток после отпуска: <b>{Math.max(0, 18 - days)} дней</b>.</div>
      </div>
    </Modal>
  );
}
