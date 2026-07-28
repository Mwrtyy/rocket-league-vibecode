import * as THREE from 'three';
import { RapierBallWorld } from '@aether/physics-adapter';
import { BALL, FIXED_DT, FixedStepRunner, runBallExperiment } from '@aether/simulation';
import './style.css';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Missing #app root.');

app.innerHTML = `<section class="panel">
  <span class="badge">120 Hz deterministic tooling</span>
  <h1>Aether Strike Physics Lab</h1>
  <p>Rapier world in metres; telemetry and exported data remain in uu.</p>
  <div class="grid">
    <button id="reset">Reset drop</button>
    <button id="launch">Launch shot</button>
    <button id="pause">Pause</button>
    <button id="export">Export JSON</button>
  </div>
  <pre id="telemetry"></pre>
</section>`;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050910);
scene.fog = new THREE.FogExp2(0x050910, 0.00016);
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 1, 30000);
camera.position.set(2600, -3600, 1900);
camera.lookAt(0, 0, 600);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
app.prepend(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xb8eaff, 0x07101b, 2.4));
const key = new THREE.DirectionalLight(0xffffff, 4);
key.position.set(1500, -2500, 4000);
scene.add(key);

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(8192, 10240, 24, 30),
  new THREE.MeshStandardMaterial({
    color: 0x102431,
    roughness: 0.62,
    metalness: 0.18,
    wireframe: true,
  }),
);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

const ballMesh = new THREE.Mesh(
  new THREE.IcosahedronGeometry(BALL.radius.value, 4),
  new THREE.MeshStandardMaterial({
    color: 0xe8f7ff,
    roughness: 0.24,
    metalness: 0.36,
    emissive: 0x113355,
  }),
);
scene.add(ballMesh);

const trailGeometry = new THREE.BufferGeometry();
const trailPositions = new Float32Array(3 * 512);
trailGeometry.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
trailGeometry.setDrawRange(0, 0);
const trail = new THREE.Line(trailGeometry, new THREE.LineBasicMaterial({ color: 0x65ddff }));
scene.add(trail);
let trailCount = 0;

const physics = await RapierBallWorld.create();
let paused = false;
let lastTime = performance.now();
const telemetry = document.querySelector<HTMLPreElement>('#telemetry');

function setScenario(position = { x: 0, y: 0, z: 1800 }, velocity = { x: 0, y: 0, z: 0 }): void {
  physics.setBall(position, velocity);
  trailCount = 0;
  trailGeometry.setDrawRange(0, 0);
}
setScenario();

const runner = new FixedStepRunner(() => {
  if (!paused) physics.step();
});

function appendTrail(x: number, y: number, z: number): void {
  const index = Math.min(trailCount, 511);
  if (trailCount >= 512) trailPositions.copyWithin(0, 3);
  const offset = index * 3;
  trailPositions[offset] = x;
  trailPositions[offset + 1] = z;
  trailPositions[offset + 2] = -y;
  trailCount = Math.min(512, trailCount + 1);
  trailGeometry.attributes.position.needsUpdate = true;
  trailGeometry.setDrawRange(0, trailCount);
}

function animate(now: number): void {
  const elapsed = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;
  const stats = runner.advance(elapsed);
  const snapshot = physics.snapshot();
  ballMesh.position.set(snapshot.position.x, snapshot.position.z, -snapshot.position.y);
  if (stats.steps > 0) appendTrail(snapshot.position.x, snapshot.position.y, snapshot.position.z);
  if (telemetry)
    telemetry.textContent = JSON.stringify(
      {
        tickRate: 1 / FIXED_DT,
        steps: stats.steps,
        alpha: Number(stats.alpha.toFixed(3)),
        ...snapshot,
      },
      null,
      2,
    );
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);

document.querySelector('#reset')?.addEventListener('click', () => setScenario());
document
  .querySelector('#launch')
  ?.addEventListener('click', () =>
    setScenario({ x: -2200, y: 0, z: 420 }, { x: 5200, y: 400, z: 1350 }),
  );
document.querySelector('#pause')?.addEventListener('click', () => {
  paused = !paused;
});
document.querySelector('#export')?.addEventListener('click', () => {
  const data = runBallExperiment({
    durationSeconds: 4,
    position: { x: 0, y: 0, z: 1800 },
    velocity: { x: 1200, y: 250, z: 0 },
  });
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const link = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(blob),
    download: 'aether-trajectory.json',
  });
  link.click();
  URL.revokeObjectURL(link.href);
});

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
