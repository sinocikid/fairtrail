import type { Metadata } from 'next';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'Fairtrail — The price trail airlines don\'t show you',
  description:
    'Track flight prices over time with shareable charts. See how fares evolve, compare airlines, and book at the right moment.',
};

const themeScript = `
  (function() {
    var t = localStorage.getItem('ft-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', t);
  })();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
