import type { Metadata } from 'next'
import { Caveat } from 'next/font/google'
import localFont from 'next/font/local'

// Only load the fonts the Polaroid actually uses
const caveat = Caveat({
  subsets: ['latin'],
  variable: '--font-caveat',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
})

const commaTrial = localFont({
  src: '../../fonts/Yasmine Nebula.otf',
  variable: '--font-comma',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'SYDE 30 Webring — Polaroid Embed',
}

export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${caveat.variable} ${commaTrial.variable}`}>
      <head />
      <body
        style={{
          margin: 0,
          padding: 0,
          background: 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          overflow: 'hidden',
        }}
      >
        {/* --font-polaroid-name must be defined here since globals.css is not imported */}
        <style>{`
          :root {
            --font-polaroid-name: var(--font-comma), 'Caveat', system-ui, -apple-system, sans-serif;
          }
          @keyframes polaroid-shimmer {
            0%   { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }
        `}</style>
        {children}
      </body>
    </html>
  )
}
