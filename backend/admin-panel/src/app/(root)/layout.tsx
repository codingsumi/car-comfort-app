import type { Metadata } from 'next';
import Script from 'next/script';
import { Toaster } from 'react-hot-toast';
import { QueryProvider } from '@/providers/QueryProvider';
import { AuthProvider } from '@/providers/AuthProvider';
import { AdminThemeProvider } from '@/providers/AdminThemeProvider';
import { ChunkLoadRecovery } from '@/components/shared/ChunkLoadRecovery';
import { THEME_INIT_SCRIPT } from '@/lib/adminTheme';
import { APP_URL } from '@/lib/paths';
import '../globals.css';
import 'mapbox-gl/dist/mapbox-gl.css';

export const metadata: Metadata = {
  metadataBase: new URL(`${APP_URL}/`),
  title: 'Car Comfort Admin',
  description: 'Admin Panel for Car Comfort Platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <Script id="admin-theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
      </head>
      <body>
        <ChunkLoadRecovery />
        <QueryProvider>
          <AdminThemeProvider>
            <AuthProvider>
              {children}
            </AuthProvider>
          </AdminThemeProvider>
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                borderRadius: '12px',
                padding: '12px 16px',
                fontSize: '14px',
              },
              success: {
                iconTheme: { primary: '#00A416', secondary: '#fff' },
              },
              error: {
                iconTheme: { primary: '#E4101F', secondary: '#fff' },
              },
            }}
          />
        </QueryProvider>
      </body>
    </html>
  );
}
