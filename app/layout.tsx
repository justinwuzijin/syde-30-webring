import type { Metadata, Viewport } from 'next'
import { Inter, JetBrains_Mono, Caveat, Permanent_Marker, Bebas_Neue } from 'next/font/google'
import localFont from 'next/font/local'
import { Analytics } from '@vercel/analytics/next'
import { Providers } from '@/components/providers'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
})

const caveat = Caveat({
  subsets: ['latin'],
  variable: '--font-caveat',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
})

const permanentMarker = Permanent_Marker({
  subsets: ['latin'],
  variable: '--font-permanent-marker',
  weight: '400',
  display: 'swap',
})

const bebasNeue = Bebas_Neue({
  subsets: ['latin'],
  variable: '--font-bebas-neue',
  weight: '400',
  display: 'swap',
})

const commaTrial = localFont({
  src: './fonts/Yasmine Nebula.otf',
  variable: '--font-comma',
  display: 'swap',
})

const figmaSans = localFont({
  src: './fonts/FIgma Sans VF.ttf',
  variable: '--font-figma-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'SYDE 30 Webring',
  description: 'A webring for Systems Design Engineering 2030 at the University of Waterloo.',
}

export const viewport: Viewport = {
  themeColor: '#0a0a0f',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable} ${caveat.variable} ${permanentMarker.variable} ${commaTrial.variable} ${figmaSans.variable} ${bebasNeue.variable}`}>
      <head />
      <body className="font-sans antialiased" suppressHydrationWarning>
        <Providers>
          {children}
          <Analytics />
        </Providers>
      </body>
    </html>
  )
}
