'use client'

import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { AssetLoadingSpinner } from './asset-loading-spinner'

const TransitionContext = createContext<{
  startTransition: () => void
}>({ startTransition: () => {} })

export function usePageTransition() {
  return useContext(TransitionContext)
}

export function PageTransitionProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(false)
  const pathname = usePathname()

  const startTransition = useCallback(() => {
    setIsLoading(true)
  }, [])

  // Hide spinner when pathname changes (new page has loaded)
  useEffect(() => {
    setIsLoading(false)
  }, [pathname])

  return (
    <TransitionContext.Provider value={{ startTransition }}>
      {children}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <AssetLoadingSpinner />
          </motion.div>
        )}
      </AnimatePresence>
    </TransitionContext.Provider>
  )
}
