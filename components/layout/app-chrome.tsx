'use client'
import { useEffect, useState, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { DeviceStatusPill } from '@/components/device/device-status'
import { DeviceConnectModal } from '@/components/device/device-connect'

function ScrollToTopOnRouteChange() {
  const pathname = usePathname()

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [pathname])

  return null
}

// Client-side wrapper that owns the modal open/close state and
// sits alongside the page content. Kept intentionally thin —
// the layout.tsx server component composes this around {children}.
export function AppChrome({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <ScrollToTopOnRouteChange />
      {children}
      <DeviceStatusPill onTap={() => setOpen(true)} />
      <DeviceConnectModal open={open} onClose={() => setOpen(false)} />
    </>
  )
}
