// src/app/now-playing-tv/layout.tsx - Clean layout without navigation for TV display
export default function TVLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={{ 
      background: '#000', 
      color: '#fff', 
      minHeight: '100vh',
      margin: 0,
      padding: 0
    }}>
      {children}
    </div>
  );
}