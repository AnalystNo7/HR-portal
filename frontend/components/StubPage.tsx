import { EmptyCube } from '@/components/illustrations/Illustrations';

interface StubPageProps {
  title: string;
  text?: string;
}

export function StubPage({ title, text }: StubPageProps) {
  return (
    <div className="card" style={{ padding: 48 }}>
      <div className="empty">
        <div className="ill"><EmptyCube w={140} /></div>
        <h3 style={{ fontFamily: 'var(--font-head)', fontSize: 24, color: 'var(--gpc-blue-800)' }}>{title}</h3>
        <p style={{ maxWidth: 480, margin: '10px auto' }}>
          {text || 'Модуль в разработке. Запуск запланирован в следующем релизе.'}
        </p>
        <button className="btn btn-secondary" style={{ marginTop: 14 }}>Подписаться на обновления</button>
      </div>
    </div>
  );
}
