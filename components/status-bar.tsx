'use client'

interface StatusBarProps {
  memberCount: number
  edgeCount: number
}

export function StatusBar({ memberCount, edgeCount }: StatusBarProps) {
  return (
    <div
      className="fixed bottom-0 left-0 right-0 flex items-center justify-between px-6 py-4 md:px-10"
      style={{
        zIndex: 50,
        background: 'linear-gradient(to top, var(--bg) 0%, transparent 100%)',
      }}
    >
      {/* Left: stats */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <div
            className="w-1.5 h-1.5 rounded-full"
            style={{
              backgroundColor: 'var(--accent-6)',
              animation: 'pulseGlow 2s ease-in-out infinite',
            }}
          />
          <span
            className="font-mono text-[11px] tracking-wider uppercase"
            style={{ color: 'var(--text-muted)' }}
          >
            {memberCount} nodes
          </span>
        </div>
        <span
          className="font-mono text-[11px] tracking-wider uppercase"
          style={{ color: 'var(--text-muted)' }}
        >
          {edgeCount} threads
        </span>
      </div>

      {/* Right: controls hint */}
      <div
        className="hidden md:flex items-center gap-4 font-mono text-[11px] tracking-wider uppercase"
        style={{ color: 'var(--text-muted)' }}
      >
        <span>Scroll to zoom</span>
        <span style={{ color: 'var(--border)' }}>|</span>
        <span>Drag to pan</span>
      </div>
    </div>
  )
}
