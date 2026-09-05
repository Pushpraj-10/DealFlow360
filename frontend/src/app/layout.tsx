import { AppShell } from '@/components/layout/AppShell';
import './globals.css';

export const metadata = {
  title: 'DealFlow360',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang='en'>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
