// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { Object3DNode, MaterialNode, BufferGeometryNode } from '@react-three/fiber'
import type { Mesh, PlaneGeometry, TorusGeometry, MeshStandardMaterial, AmbientLight, DirectionalLight, PointLight } from 'three'

declare module '@react-three/fiber' {
  interface ThreeElements {
    mesh: Object3DNode<Mesh, typeof Mesh>
    planeGeometry: BufferGeometryNode<PlaneGeometry, typeof PlaneGeometry>
    torusGeometry: BufferGeometryNode<TorusGeometry, typeof TorusGeometry>
    meshStandardMaterial: MaterialNode<MeshStandardMaterial, typeof MeshStandardMaterial>
    ambientLight: Object3DNode<AmbientLight, typeof AmbientLight>
    directionalLight: Object3DNode<DirectionalLight, typeof DirectionalLight>
    pointLight: Object3DNode<PointLight, typeof PointLight>
  }
}
