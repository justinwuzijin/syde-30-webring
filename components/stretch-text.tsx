interface StretchTextProps {
  lines: string[]
  viewBox: string
  fontSize?: number
  lineHeight?: number
  className?: string
  fill?: string
  'aria-label'?: string
}

export function StretchText({
  lines,
  viewBox,
  fontSize = 280,
  lineHeight,
  className,
  fill = 'black',
  'aria-label': ariaLabel,
}: StretchTextProps) {
  const [, , vbWidth, vbHeight] = viewBox.split(' ').map(Number)
  const gap = lineHeight ?? fontSize * 1.05
  const totalTextHeight = (lines.length - 1) * gap + fontSize
  // Center text vertically in viewBox
  const startY = (vbHeight - totalTextHeight) / 2 + fontSize * 0.78

  return (
    <svg
      viewBox={viewBox}
      preserveAspectRatio="none"
      className={className}
      style={{ width: '100%', height: '100%', display: 'block' }}
      overflow="visible"
      role="img"
      aria-label={ariaLabel ?? lines.join(' ')}
    >
      {lines.map((line, i) => (
        <text
          key={i}
          x={0}
          y={startY + i * gap}
          textLength={vbWidth}
          lengthAdjust="spacingAndGlyphs"
          style={{
            fontFamily: 'var(--font-figma-sans)',
            fontSize,
            fontWeight: 500,
            fill,
          }}
        >
          {line}
        </text>
      ))}
    </svg>
  )
}
