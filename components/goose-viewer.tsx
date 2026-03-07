'use client'

import { Suspense, useLayoutEffect, useRef, useState, useCallback, useEffect } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { useGLTF, useAnimations, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'

const MIN_CANVAS_WIDTH = 200
const MIN_CANVAS_HEIGHT = 200

function GooseMesh({ onReady }: { onReady: () => void }) {
  const groupRef = useRef<THREE.Group>(null)
  const { scene, animations } = useGLTF('/goose.glb')
  const { actions, names } = useAnimations(animations, groupRef)
  const { camera, size } = useThree()

  // Play animation on mount
  useEffect(() => {
    if (names.length > 0) {
      // Log available animations for debugging
      console.log('Available goose animations:', names)
      
      // Play the first available animation, looping
      const firstAction = actions[names[0]]
      if (firstAction) {
        firstAction.reset().fadeIn(0.5).play()
        firstAction.setLoop(THREE.LoopRepeat, Infinity)
      }
    }
    
    return () => {
      // Cleanup: fade out all actions
      names.forEach(name => {
        actions[name]?.fadeOut(0.5)
      })
    }
  }, [actions, names])

  // Re-run setup when canvas has valid size (fixes shrink after client-side navigation)
  useLayoutEffect(() => {
    if (size.width <= 0 || size.height <= 0) return

    scene.updateMatrixWorld(true)

    const box = new THREE.Box3().setFromObject(scene)
    const center = new THREE.Vector3()
    const sizeVec = new THREE.Vector3()
    box.getCenter(center)
    box.getSize(sizeVec)

    const maxDim = Math.max(sizeVec.x, sizeVec.y, sizeVec.z)
    const s = maxDim > 0 ? 2.2 / maxDim : 1

    scene.scale.setScalar(s)
    scene.position.set(-center.x * s, -center.y * s, -center.z * s)

    const cam = camera as THREE.PerspectiveCamera
    const fovRad = cam.fov * (Math.PI / 180)
    const dist = (s * maxDim * 0.5) / Math.tan(fovRad * 0.5) * 1.4
    cam.position.set(0, 0, dist)
    cam.near = dist / 100
    cam.far = dist * 100
    cam.updateProjectionMatrix()

    onReady()
  }, [scene, camera, onReady, size.width, size.height])

  return (
    <group ref={groupRef}>
      <primitive object={scene} />
    </group>
  )
}

useGLTF.preload('/goose.glb')

export default function GooseViewer() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensionsReady, setDimensionsReady] = useState(false)
  const [visible, setVisible] = useState(false)
  const handleReady = useCallback(() => setVisible(true), [])

  // Defer Canvas mount until container has valid dimensions (prevents 300x150 fallback on client-side nav)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const checkDimensions = () => {
      const { width, height } = el.getBoundingClientRect()
      if (width >= MIN_CANVAS_WIDTH && height >= MIN_CANVAS_HEIGHT) {
        setDimensionsReady(true)
        return true
      }
      return false
    }

    if (checkDimensions()) return

    const ro = new ResizeObserver(() => {
      if (checkDimensions()) ro.disconnect()
    })
    ro.observe(el)

    // Fallback: layout may be delayed (e.g. after client-side navigation). Force render after delay.
    const fallbackId = setTimeout(() => {
      if (!checkDimensions()) setDimensionsReady(true)
      ro.disconnect()
    }, 150)

    return () => {
      ro.disconnect()
      clearTimeout(fallbackId)
    }
  }, [])

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        minWidth: 320,
        minHeight: 360,
        opacity: visible ? 1 : 0,
      }}
    >
      {dimensionsReady && (
        <Canvas
          camera={{ position: [0, 0, 5], fov: 50 }}
          gl={{ alpha: true, antialias: true }}
          style={{ background: 'transparent' }}
          resize={{ debounce: 0 }}
        >
          <ambientLight intensity={1.2} />
          <directionalLight position={[3, 6, 4]} intensity={2.5} />
          <directionalLight position={[-3, 2, -3]} intensity={0.6} />
          <Suspense fallback={null}>
            <GooseMesh onReady={handleReady} />
          </Suspense>
          <OrbitControls
            enableZoom={false}
            enablePan={false}
            autoRotate
            autoRotateSpeed={0.8}
          />
        </Canvas>
      )}
    </div>
  )
}
