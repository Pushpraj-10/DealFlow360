import { Sidebar } from '../../components/layout/Sidebar';
import '../globals.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang='en'>
      <body>
        <div className='flex min-h-screen bg-gray-50 text-gray-900'>
          <Sidebar />
          <main className='flex-1 overflow-y-auto'>
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
