import type { Metadata } from 'next';
import { Inter, PT_Sans_Narrow } from 'next/font/google';
import { AuthProvider } from '@/contexts/AuthContext';
import { AppShell } from '@/components/layout/AppShell';

import './styles/tokens.css';
import './styles/shell.css';
import './styles/components.css';
import './styles/pages.css';

const inter = Inter({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-inter',
  display: 'swap',
});

const ptSansNarrow = PT_Sans_Narrow({
  subsets: ['latin', 'cyrillic'],
  weight: ['700'],
  variable: '--font-pt-sans-narrow',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'HR-портал',
  description: 'HR-портал для сотрудников',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className={`${inter.variable} ${ptSansNarrow.variable}`} data-density="comfortable">
      <body>
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}
