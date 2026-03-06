'use client'

import { useEffect, useRef } from 'react'

interface SpiderwebBackgroundProps {
  className?: string
}

export function SpiderwebBackground({ className = '' }: SpiderwebBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationId: number
    let time = 0

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    // Web nodes - fixed positions that form the spiderweb structure
    const nodes: { x: number; y: number; baseX: number; baseY: number }[] = []
    const numNodes = 40

    const initNodes = () => {
      nodes.length = 0
      const w = canvas.width
      const h = canvas.height
      
      // Create nodes in a radial pattern from center
      const centerX = w / 2
      const centerY = h / 2
      
      // Center node
      nodes.push({ x: centerX, y: centerY, baseX: centerX, baseY: centerY })
      
      // Rings of nodes
      const rings = [
        { radius: Math.min(w, h) * 0.15, count: 6 },
        { radius: Math.min(w, h) * 0.3, count: 10 },
        { radius: Math.min(w, h) * 0.45, count: 14 },
        { radius: Math.min(w, h) * 0.65, count: 10 },
      ]
      
      rings.forEach(ring => {
        for (let i = 0; i < ring.count; i++) {
          const angle = (i / ring.count) * Math.PI * 2 + Math.random() * 0.3
          const r = ring.radius + (Math.random() - 0.5) * 50
          const x = centerX + Math.cos(angle) * r
          const y = centerY + Math.sin(angle) * r
          nodes.push({ x, y, baseX: x, baseY: y })
        }
      })
    }
    initNodes()

    // Find connections - nodes within distance
    const getConnections = () => {
      const connections: [number, number][] = []
      const maxDist = Math.min(canvas.width, canvas.height) * 0.25
      
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x
          const dy = nodes[i].y - nodes[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < maxDist) {
            connections.push([i, j])
          }
        }
      }
      return connections
    }

    const draw = () => {
      time += 0.008
      
      ctx.fillStyle = '#0a0a0f'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      
      // Animate node positions slightly
      nodes.forEach((node, i) => {
        const offsetX = Math.sin(time + i * 0.5) * 3
        const offsetY = Math.cos(time * 0.7 + i * 0.3) * 3
        node.x = node.baseX + offsetX
        node.y = node.baseY + offsetY
      })
      
      const connections = getConnections()
      
      // Draw web threads with subtle glow
      connections.forEach(([i, j], idx) => {
        const n1 = nodes[i]
        const n2 = nodes[j]
        
        // Calculate control point for curved line (sag effect)
        const mx = (n1.x + n2.x) / 2
        const my = (n1.y + n2.y) / 2
        const dist = Math.sqrt((n2.x - n1.x) ** 2 + (n2.y - n1.y) ** 2)
        const sag = Math.sin(time * 0.5 + idx * 0.1) * 8 + dist * 0.05
        
        // Animated opacity
        const opacity = 0.08 + Math.sin(time + idx * 0.2) * 0.03
        
        ctx.beginPath()
        ctx.moveTo(n1.x, n1.y)
        ctx.quadraticCurveTo(mx, my + sag, n2.x, n2.y)
        ctx.strokeStyle = `rgba(200, 190, 170, ${opacity})`
        ctx.lineWidth = 0.5
        ctx.stroke()
      })
      
      // Draw subtle node points
      nodes.forEach((node, i) => {
        const pulse = 0.5 + Math.sin(time * 2 + i) * 0.5
        const radius = 1 + pulse * 0.5
        const opacity = 0.1 + pulse * 0.05
        
        ctx.beginPath()
        ctx.arc(node.x, node.y, radius, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(200, 190, 170, ${opacity})`
        ctx.fill()
      })
      
      animationId = requestAnimationFrame(draw)
    }
    
    draw()

    return () => {
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(animationId)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 ${className}`}
      style={{ zIndex: 0 }}
    />
  )
}
