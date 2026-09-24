import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';

const archivo = localFont({
  src: [
    { path: '../fonts/archivo-latin-400-normal.woff2', weight: '400' },
    { path: '../fonts/archivo-latin-500-normal.woff2', weight: '500' },
    { path: '../fonts/archivo-latin-600-normal.woff2', weight: '600' },
  ],
  variable: '--font-archivo',
});

export const metadata: Metadata = { title: 'Resource Manager', description: 'Bookmarks and inspiration wall' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={archivo.variable}>
      <body>{children}</body>
    </html>
  );
}
