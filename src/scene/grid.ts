// Metric grid drawn by a shader on one 200 m plane: 0.1 m / 1 m / 10 m lines, each faded in by its
// on-screen spacing, so it adapts to zoom in 2D and to distance in 3D without moiré.
// (Line geometry was dropped: long GL lines crossing behind the perspective camera vanish on some drivers.)
import * as THREE from 'three'

const EXTENT = 200
const COLORS = { light: [0xd4d4d8, 0xa1a1aa, 0x71717a], dark: [0x323238, 0x52525b, 0x71717a] }

const vertexShader = /* glsl */ `
  varying vec2 vPlan;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vPlan = w.xz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }`

const fragmentShader = /* glsl */ `
  uniform vec3 colors[3];
  varying vec2 vPlan;
  float level(float step) {
    vec2 c = vPlan / step;
    vec2 fw = fwidth(c);
    vec2 d = abs(fract(c - 0.5) - 0.5) / fw;   // distance to the nearest line, in pixels
    float px = 1.0 / max(fw.x, fw.y);          // cell size in pixels
    return (1.0 - min(min(d.x, d.y), 1.0)) * clamp((px - 4.0) / 12.0, 0.0, 1.0);
  }
  void main() {
    float a0 = level(0.1), a1 = level(1.0), a2 = level(10.0);
    float a = max(a0, max(a1, a2));
    if (a <= 0.0) discard;
    gl_FragColor = vec4(mix(mix(colors[0], colors[1], a1), colors[2], a2), a);
  }`

export function createGrid() {
  const uniforms = { colors: { value: COLORS.light.map(c => new THREE.Color(c)) } }
  const object = new THREE.Mesh(
    new THREE.PlaneGeometry(EXTENT, EXTENT).rotateX(-Math.PI / 2),
    new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader, transparent: true, depthWrite: false })
  )
  object.renderOrder = -1

  return {
    object,
    update(elevation: number) {
      object.position.y = elevation - 0.02 // under garden zones and room floors, so they hide it
    },
    setTheme(dark: boolean) {
      COLORS[dark ? 'dark' : 'light'].forEach((c, i) => uniforms.colors.value[i].setHex(c))
    }
  }
}
