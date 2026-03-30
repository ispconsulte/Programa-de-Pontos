import { useRef, Suspense, Component, type ReactNode } from 'react'
import { Canvas, useFrame, useLoader } from '@react-three/fiber'
import { Float, Environment } from '@react-three/drei'
import * as THREE from 'three'

interface Logo3DProps {
  textureUrl: string
}

interface ErrorBoundaryState {
  hasError: boolean
}

class Logo3DErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false }
  static getDerivedStateFromError() { return { hasError: true } }
  render() {
    return this.state.hasError ? this.props.fallback : this.props.children
  }
}

function LogoPlane({ textureUrl }: { textureUrl: string }) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const texture = useLoader(THREE.TextureLoader, textureUrl)
  texture.colorSpace = THREE.SRGBColorSpace

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.15
      meshRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.3) * 0.05
    }
  })

  return (
    <Float speed={2} rotationIntensity={0.3} floatIntensity={0.8}>
      <mesh ref={meshRef}>
        <planeGeometry args={[3, 3]} />
        <meshStandardMaterial
          map={texture}
          transparent
          side={THREE.DoubleSide}
          roughness={0.3}
          metalness={0.1}
        />
      </mesh>
    </Float>
  )
}

function GlowRing() {
  const ringRef = useRef<THREE.Mesh>(null!)

  useFrame((state) => {
    if (ringRef.current) {
      ringRef.current.rotation.z = state.clock.elapsedTime * 0.2
      ringRef.current.rotation.x = Math.PI * 0.5 + Math.sin(state.clock.elapsedTime * 0.4) * 0.1
    }
  })

  return (
    <mesh ref={ringRef} position={[0, 0, -0.3]}>
      <torusGeometry args={[2.2, 0.03, 16, 80]} />
      <meshStandardMaterial
        color="#3b82f6"
        emissive="#3b82f6"
        emissiveIntensity={0.8}
        transparent
        opacity={0.4}
      />
    </mesh>
  )
}

function Logo3DCanvas({ textureUrl }: Logo3DProps) {
  return (
    <Canvas
      camera={{ position: [0, 0, 5], fov: 45 }}
      style={{ width: '100%', height: '100%' }}
      gl={{ antialias: true, alpha: true }}
    >
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 5, 5]} intensity={0.8} />
      <pointLight position={[-3, 2, 4]} intensity={0.5} color="#3b82f6" />
      <Suspense fallback={null}>
        <LogoPlane textureUrl={textureUrl} />
        <GlowRing />
        <Environment preset="city" />
      </Suspense>
    </Canvas>
  )
}

export default function Logo3DScene({ textureUrl }: Logo3DProps) {
  const fallback = (
    <img src={textureUrl} alt="Logo" className="h-full w-full object-contain animate-float" />
  )

  return (
    <Logo3DErrorBoundary fallback={fallback}>
      <Logo3DCanvas textureUrl={textureUrl} />
    </Logo3DErrorBoundary>
  )
}
