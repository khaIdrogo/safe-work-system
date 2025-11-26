import '@/app/globals.css';
import Header from '@/components/Header';
export const metadata = { title: 'Safe Work System', description: 'Permit & Inspection Management' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en"><body><Header /><main className="p-4 max-w-[1200px] mx-auto">{children}</main></body></html>
  );
}
