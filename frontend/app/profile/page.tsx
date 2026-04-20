'use client';

import React, { useState } from 'react';
import { Icon, Modal, Avatar, useToast } from '@/components/primitives';
import { PersonProfile, PeopleTalk, EmptyCube, Vacation } from '@/components/illustrations/Illustrations';
import { useAuth } from '@/contexts/AuthContext';

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
  const [edit, setEdit] = useState(false);
  const [vacOpen, setVacOpen] = useState(false);
  const toast = useToast();

  return (
    <div>
      <div className="tabs">
        {TABS.map(t => (
          <button key={t.id} aria-selected={tab === t.id} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>

      <div className="profile-head">
        <div className="photo av-blue" style={{ fontSize: 24, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {user.lastName[0]}{user.firstName[0]}
        </div>
        <div className="names">
          <h1>{user.lastName} {user.firstName} {user.middleName}</h1>
          <div className="role">{user.position} · {user.department} · ООО «Газпром ЦПС»</div>
          <div className="meta">
            <span>Руководитель: <b>Петров О. Н.</b></span>
            <span>В компании: <b>3 года 4 мес.</b></span>
            <span>Санкт-Петербург</span>
          </div>
        </div>
        <div>
          {tab === 'profile' && (
            edit ? (
              <>
                <button className="btn btn-secondary" onClick={() => setEdit(false)}>Отмена</button>{' '}
                <button className="btn btn-primary" onClick={() => { setEdit(false); toast('Профиль сохранён'); }}>
                  <Icon name="check" size={16} /> Сохранить
                </button>
              </>
            ) : (
              <button className="btn btn-secondary" onClick={() => setEdit(true)}>
                <Icon name="edit" size={16} /> Редактировать
              </button>
            )
          )}
        </div>
      </div>

      {tab === 'profile' && <ProfileTab edit={edit} />}
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

function ProfileTab({ edit }: { edit: boolean }) {
  return (
    <div>
      <div className="profile-callouts">
        <div className="banner">
          <div className="ill"><PersonProfile w={160} /></div>
          <div className="b-body">
            <h3>Заполните профиль полностью</h3>
            <p>Полный профиль помогает коллегам найти вас по навыкам, а HR — подобрать релевантные проекты и обучение. Заполнено на 72%.</p>
            <button className="btn btn-primary btn-sm" style={{ marginTop: 10 }}>Продолжить заполнение</button>
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

      <Section title="Основные данные" onAdd={edit ? () => {} : undefined}>
        {edit ? (
          <div className="grid-2">
            <div className="field"><label>Фамилия</label><input className="inp" defaultValue="Морозов" /></div>
            <div className="field"><label>Имя</label><input className="inp" defaultValue="Александр" /></div>
            <div className="field"><label>Отчество</label><input className="inp" defaultValue="Викторович" /></div>
            <div className="field"><label>Дата рождения</label><input className="inp" type="date" defaultValue="1990-06-14" /></div>
            <div className="field"><label>Город</label><input className="inp" defaultValue="Санкт-Петербург" /></div>
            <div className="field"><label>Табельный номер</label><input className="inp" defaultValue="ЦПС-01274" readOnly /></div>
          </div>
        ) : (
          <dl className="kv-list">
            <dt>ФИО</dt><dd>Морозов Александр Викторович</dd>
            <dt>Дата рождения</dt><dd>14 июня 1990</dd>
            <dt>Город</dt><dd>Санкт-Петербург</dd>
            <dt>Табельный номер</dt><dd>ЦПС-01274</dd>
            <dt>Подразделение</dt><dd>Блок ИТ / Отдел разработки</dd>
            <dt>Семья и уровень</dt><dd>ИТ-разработка · Senior (L4)</dd>
          </dl>
        )}
      </Section>

      <Section title="Контакты" onAdd={edit ? () => {} : undefined}>
        {edit ? (
          <div className="grid-2">
            <div className="field"><label>Рабочий e-mail</label><input className="inp" defaultValue="morozov.av@gazpromcps.ru" readOnly /></div>
            <div className="field"><label>Личный e-mail</label><input className="inp" defaultValue="a.morozov@example.com" /></div>
            <div className="field"><label>Мобильный</label><input className="inp" defaultValue="+7 (921) 555-42-18" /></div>
            <div className="field"><label>Внутренний номер</label><input className="inp" defaultValue="4218" /></div>
          </div>
        ) : (
          <dl className="kv-list">
            <dt>Рабочий e-mail</dt><dd>morozov.av@gazpromcps.ru</dd>
            <dt>Мобильный</dt><dd>+7 (921) 555-42-18</dd>
            <dt>Внутренний</dt><dd>4218</dd>
            <dt>Telegram</dt><dd>@a_morozov</dd>
          </dl>
        )}
      </Section>

      <Section title="О себе">
        {edit ? (
          <textarea className="ta" rows={4} defaultValue="Занимаюсь архитектурой бэкенда корпоративных сервисов. Люблю велосипед и походы." />
        ) : (
          <p style={{ fontSize: 13.5, color: 'var(--gpc-gray-700)' }}>
            Занимаюсь архитектурой бэкенда корпоративных сервисов. Люблю велосипед и походы.
          </p>
        )}
      </Section>

      <Section title="Образование" onAdd={() => {}}>
        <div className="item-row">
          <div className="time">2008 – 2013</div>
          <div className="body">
            <b>СПбГПУ · Институт компьютерных наук и технологий</b>
            <p>Магистр, «Программная инженерия»</p>
          </div>
        </div>
        <div className="item-row">
          <div className="time">2019</div>
          <div className="body">
            <b>Stanford Online · Architecting on AWS</b>
            <p>Сертификация</p>
          </div>
        </div>
      </Section>

      <Section title="Опыт работы" onAdd={() => {}}>
        <div className="item-row">
          <div className="time">2022 – настоящее</div>
          <div className="body">
            <b>Газпром ЦПС · Ведущий инженер</b>
            <p>Архитектура корпоративной интеграционной платформы</p>
          </div>
        </div>
        <div className="item-row">
          <div className="time">2017 – 2022</div>
          <div className="body">
            <b>«ИнтеграТех» · Senior backend engineer</b>
            <p>Разработка высоконагруженных сервисов</p>
          </div>
        </div>
        <div className="item-row">
          <div className="time">2013 – 2017</div>
          <div className="body">
            <b>«Софтлаб» · Backend-разработчик</b>
          </div>
        </div>
      </Section>

      <Section title="Языки" onAdd={() => {}}>
        <dl className="kv-list">
          <dt>Русский</dt><dd>Родной</dd>
          <dt>Английский</dt><dd>B2 (Upper-Intermediate)</dd>
        </dl>
      </Section>

      <Section title="Навыки" onAdd={() => {}}>
        <div>
          {['Java', 'Kotlin', 'Spring', 'PostgreSQL', 'Kubernetes', 'Kafka', 'Системная архитектура', 'Code Review', 'Менторство'].map((s, i) => (
            <span key={i} className="skill-chip" data-level={i < 3 ? '3' : '1'}>{s}</span>
          ))}
        </div>
      </Section>

      <Section title="Сертификаты" onAdd={() => {}}>
        <div className="empty">
          <div className="ill"><EmptyCube w={80} /></div>
          <h3>Сертификаты ещё не добавлены</h3>
          <p style={{ fontSize: 12.5 }}>Добавьте подтверждения курсов, сертификации и профессиональных достижений.</p>
        </div>
      </Section>
    </div>
  );
}

function CompetenciesTab() {
  return (
    <div className="card" style={{ marginTop: 16, padding: 40 }}>
      <div className="empty">
        <div className="ill"><EmptyCube w={120} /></div>
        <h3 style={{ fontFamily: 'var(--font-head)', fontSize: 22, color: 'var(--gpc-blue-800)' }}>Матрица компетенций</h3>
        <p style={{ maxWidth: 480, margin: '8px auto' }}>
          Модуль самооценки по семьям ролей и уровням. Запуск — III квартал 2025.
        </p>
        <button className="btn btn-secondary" style={{ marginTop: 12 }}>Подписаться на уведомление о запуске</button>
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
        <div style={{ marginTop: 12, display: 'inline-flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          <span className="pill pill-blue pill-dot">Октябрь 2025 · плановая</span>
          <span className="pill pill-gray">Оценка 360°</span>
        </div>
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
          <p>14 дней основного отпуска и 4 дня накопленных с прошлого года. Запланируйте отпуск заранее, чтобы согласовать с руководителем.</p>
          <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
            <button className="btn btn-primary btn-sm" onClick={onRequest}>
              <Icon name="plus" size={14} /> Заявка на отпуск
            </button>
            <button className="btn btn-secondary btn-sm">
              <Icon name="calendar" size={14} /> Мой график
            </button>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-head"><h3>Ближайшие отсутствия</h3></div>
        <table className="tbl">
          <thead>
            <tr><th>Тип</th><th>С</th><th>По</th><th>Дней</th><th>Статус</th><th></th></tr>
          </thead>
          <tbody>
            <tr>
              <td>Ежегодный</td><td>12.08.2025</td><td>25.08.2025</td><td className="num">14</td>
              <td><span className="pill pill-green pill-dot">Согласован</span></td>
              <td><button className="btn btn-ghost btn-sm">Детали</button></td>
            </tr>
            <tr>
              <td>За свой счёт</td><td>03.11.2025</td><td>05.11.2025</td><td className="num">3</td>
              <td><span className="pill pill-yellow pill-dot">На согласовании</span></td>
              <td><button className="btn btn-ghost btn-sm">Детали</button></td>
            </tr>
            <tr>
              <td>Ежегодный</td><td>22.12.2024</td><td>31.12.2024</td><td className="num">10</td>
              <td><span className="pill pill-gray pill-dot">Прошёл</span></td>
              <td><button className="btn btn-ghost btn-sm">Детали</button></td>
            </tr>
          </tbody>
        </table>
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
      <div className="field" style={{ marginTop: 14 }}>
        <label>Комментарий для руководителя (необязательно)</label>
        <textarea className="ta" rows={3} placeholder="Например, передача проекта коллеге..." />
      </div>
      <label className="chk" style={{ marginTop: 12 }}>
        <input type="checkbox" /> Заменяющий сотрудник согласован
      </label>
    </Modal>
  );
}
