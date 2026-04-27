import type { Metadata, Viewport } from 'next'
import './globals.css'
import { EMGProvider } from '@/lib/emg/context'
import { MuscleSelectionProvider } from '@/lib/muscle-selection-context'
import { FloatingNav } from '@/components/layout/bottom-nav'
import { AppChrome } from '@/components/layout/app-chrome'
import { DeviceLabelSync } from '@/components/device/device-label-sync'

export const metadata: Metadata = {
  title: 'MyoPack',
  description: 'EMG Rehabilitation System',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased" style={{ background: 'var(--mp-bg)', color: 'var(--mp-t1)' }}>
        <EMGProvider>
          <MuscleSelectionProvider>
            <DeviceLabelSync />
            <AppChrome>
              <main
                className="min-h-screen w-full max-w-md mx-auto"
                style={{ paddingBottom: 'calc(5.5rem + env(safe-area-inset-bottom))' }}
              >
                {children}
              </main>
            </AppChrome>
            <FloatingNav />
          </MuscleSelectionProvider>
        </EMGProvider>
      </body>
    </html>
  )
}
