'use client'

import { useEffect } from 'react'
import { usePageTransition } from '@/components/page-transition'
import { JoinForm } from '@/components/join-form'

export default function JoinPage() {
  const { endTransition } = usePageTransition()

  useEffect(() => {
    // Signal the transition gate that this page is ready to render.
    endTransition()
  }, [endTransition])

  return <JoinForm />
}
