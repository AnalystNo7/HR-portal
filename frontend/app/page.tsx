export default function Home() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      fontFamily: 'system-ui, sans-serif',
    }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>
        HR-портал
      </h1>
      <p style={{ color: '#666', fontSize: '1.1rem' }}>
        Газпром ЦПС
      </p>
    </div>
  );
}
