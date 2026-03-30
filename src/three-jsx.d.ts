import '@react-three/fiber'

declare global {
  namespace JSX {
    interface IntrinsicElements {
      mesh: any
      planeGeometry: any
      meshStandardMaterial: any
      torusGeometry: any
      ambientLight: any
      directionalLight: any
      pointLight: any
    }
  }
}
