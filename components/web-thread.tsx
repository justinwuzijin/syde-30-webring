'use client'

interface WebThreadProps {
  sourceX: number
  sourceY: number
  targetX: number
  targetY: number
  index: number
  isHighlighted?: boolean
  accentColor?: string
}

export function WebThread({
  sourceX,
  sourceY,
  targetX,
  targetY,
  index,
  isHighlighted = false,
  accentColor,
}: WebThreadProps) {
  const mx = (sourceX + targetX) / 2
  const my = (sourceY + targetY) / 2 - 30

  // Subtle asymmetry for organic feel
  const offset = ((index * 7) % 20) - 10
  const d = `M ${sourceX} ${sourceY} Q ${mx + offset} ${my} ${targetX} ${targetY}`

  return (
    <path
      d={d}
      fill="none"
      stroke={isHighlighted && accentColor ? accentColor : 'var(--web)'}
      strokeWidth={isHighlighted ? 2 : 1}
      opacity={isHighlighted ? 0.7 : 0.15}
      className="web-thread"
      strokeLinecap="round"
      style={{
        animationDelay: `${index * 60}ms`,
        transition: 'stroke 0.25s ease, opacity 0.25s ease, stroke-width 0.25s ease',
        filter: isHighlighted ? `drop-shadow(0 0 6px ${accentColor}40)` : 'none',
      }}
    />
  )
}
