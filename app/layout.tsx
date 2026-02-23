import type { Metadata } from 'next';
import { dmSans, spectral } from './fonts';
import './globals.css';

export const metadata: Metadata = {
  title: 'Music Projects',
  description: 'Private music project management',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${dmSans.variable} ${spectral.variable}`}>
      <body className="min-h-screen bg-[var(--bg)] text-[var(--text)] font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
