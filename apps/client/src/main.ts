import * as THREE from 'three';
import { BALL, FixedStepRunner, ReferenceBallSimulation } from '@aether/simulation';
import './style.css';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Missing #app root.');
app.innerHTML = '<div class="hud"><div class="brand">AETHER STRIKE</div><div></div><div class="status">Foundation build · physics runs at 120 Hz independently of render FPS</div></div>';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x04070d);
const camera = new THREE.PerspectiveCamera(82, innerWidth / innerHeight, 1, 30000);
camera.position.set(2400, -3900, 1700);
camera.lookAt(0, 0, 500);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
app.prepend(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xa9ddff, 0x08121d, 2.5));
const light = new THREE.DirectionalLight(0xffffff, 3.4);
light.position.set(-1800, -2200, 3800);
scene.add(light);

const field = new THREE.Mesh(new THREE.PlaneGeometry(8192, 10240), new THREE.MeshStandardMaterial({ color: 0x0b2630, roughness: 0.62, metalness: 0.2 }));
field.rotation.x = -Math.PI / 2;
scene.add(field);
const grid = new THREE.GridHelper(10240, 40, 0x4be0ff, 0x173c4b);
grid.position.y = 1;
scene.add(grid);
const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(BALL.radius.value, 3), new THREE.MeshStandardMaterial({ color: 0xf5fbff, roughness: 0.3, metalness: 0.25 }));
scene.add(ball);

const simulation = new ReferenceBallSimulation();
simulation.setBall({ x: 0, y: 0, z: 1600 }, { x: 950, y: 260, z: 150 });
const runner = new FixedStepRunner(() => simulation.step());
let last = performance.now();
function frame(now: number): void {
  const elapsed = Math.min(0.1, (now - last) / 1000);
  last = now;
  const stats = runner.advance(elapsed);
  const state = simulation.interpolate(stats.alpha);
  ball.position.set(state.ballPosition.x, state.ballPosition.z, -state.ballPosition.y);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
