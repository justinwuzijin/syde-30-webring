'use client'

import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { AssetLoadingSpinner } from './asset-loading-spinner'

const MIN_LOADING_MS = 1200

const TransitionContext = createContext<{
  startTransition: (opts?: { waitForManualEnd?: boolean }) => void
  endTransition: () => void
}>({ startTransition: () => {}, endTransition: () => {} })

export function usePageTransition() {
  return useContext(TransitionContext)
}

export function PageTransitionProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true)
  const [pageReady, setPageReady] = useState(false)
  const [minElapsed, setMinElapsed] = useState(false)
  const startTimeRef = useRef(Date.now())
  const pathname = usePathname()
  const waitForManualRef = useRef(false)
  const isInitialRef = useRef(true)

  const startTransition = useCallback((opts?: { waitForManualEnd?: boolean }) => {
    isInitialRef.current = false
    waitForManualRef.current = !!opts?.waitForManualEnd
    setIsLoading(true)
    setPageReady(false)
    setMinElapsed(false)
    startTimeRef.current = Date.now()
  }, [])

  const endTransition = useCallback(() => {
    setPageReady(true)
  }, [])

  // When pathname changes, mark page ready (unless waiting for manual end)
  useEffect(() => {
    if (!waitForManualRef.current) {
      setPageReady(true)
    }
  }, [pathname])

  // Enforce minimum loading time
  useEffect(() => {
    if (!isLoading) return
    const remaining = MIN_LOADING_MS - (Date.now() - startTimeRef.current)
    const timer = setTimeout(() => setMinElapsed(true), Math.max(0, remaining))
    return () => clearTimeout(timer)
  }, [isLoading])

  // Dismiss loader only when both minimum time elapsed AND page is ready
  useEffect(() => {
    if (isLoading && pageReady && minElapsed) {
      isInitialRef.current = false
      setIsLoading(false)
    }
  }, [isLoading, pageReady, minElapsed])

  return (
    <TransitionContext.Provider value={{ startTransition, endTransition }}>
      {children}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <AssetLoadingSpinner variant={isInitialRef.current ? 'initial' : 'default'} />
          </motion.div>
        )}
      </AnimatePresence>
    </TransitionContext.Provider>
  )
}
