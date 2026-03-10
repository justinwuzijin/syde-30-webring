import { Suspense } from 'react'
import { LandingPage } from '@/components/landing-page'

export default function HomePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <LandingPage />
    </Suspense>
  )
}
