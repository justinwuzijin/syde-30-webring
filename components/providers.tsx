'use client'

import { AuthProvider } from '@/lib/auth-context'
import { PageTransitionProvider } from './page-transition'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <PageTransitionProvider>
        {children}
      </PageTransitionProvider>
    </AuthProvider>
  )
}
