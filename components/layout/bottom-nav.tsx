'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'

const navItems = [
  {
    href: '/today',
    label: 'Monitor',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <circle cx="9" cy="9" r="6.5" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M9 5.5v3.5l2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    href: '/vitals',
    label: 'Signal',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M1 9h3l2.5-5 3 10 2-6 1.5 3H17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    href: '/health',
    label: 'Recovery',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M2 13l4-4 3 2 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M13 5h3v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
]

export function FloatingNav() {
  const pathname = usePathname()

  return (
    <nav
      style={{
        position: 'fixed',
        bottom: '1.25rem',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 50,
        background: 'var(--mp-s2)',
        border: '1px solid var(--mp-line2)',
        borderRadius: 9999,
        padding: 6,
        display: 'flex',
        gap: 4,
        boxShadow: '0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.06)',
      }}
    >
      {navItems.map(({ href, label, icon }) => {
        const isActive = pathname === href || pathname.startsWith(href + '/')
        return (
          <Link
            key={href}
            href={href}
            aria-label={label}
            className="relative flex flex-col items-center justify-center"
            style={{
              width: 68,
              height: 44,
              gap: 3,
              color: isActive ? 'var(--mp-jade)' : 'var(--mp-t4)',
              textDecoration: 'none',
            }}
          >
            {isActive && (
              <motion.div
                layoutId="nav-pill"
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'rgba(31,216,164,0.12)',
                  borderRadius: 9999,
                }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              />
            )}

            <span style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {icon}
            </span>

            <span
              style={{
                position: 'relative',
                zIndex: 1,
                fontSize: 8,
                fontWeight: 600,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                lineHeight: 1,
              }}
            >
              {label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
