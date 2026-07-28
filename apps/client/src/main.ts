import * as THREE from 'three';
import {
  BALL,
  CAR,
  FixedStepRunner,
  GameSimulation,
  type PlayerInputFrame,
} from '@aether/simulation';
import './style.css';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Missing #app root.');

app.innerHTML = `
  <div class="hud">
    <header class="topbar">
      <div class="brand">AETHER STRIKE</div>
      <div class="mode">FREE PLAY · LOCAL 120 HZ</div>
    </header>
    <div class="telemetry">
      <span id="speed">0 KM/H</span>
      <span id="state">GROUNDED</span>
    </div>
    <div class="boost"><span id="boost-value">100</span><small>BOOST</small></div>
    <div class="controls">WASD drive · Space jump/dodge · Shift boost · Ctrl powerslide · C ball camera · R reset</div>
  </div>`;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x03070d);
scene.fog = new THREE.FogExp2(0x03070d, 0.00012);

const camera = new THREE.PerspectiveCamera(82, innerWidth / innerHeight, 1, 30000);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
app.prepend(renderer.domElement);

scene.add(new THREE.HemisphereLight(0x9cddff, 0x07101c, 2.2));
const keyLight = new THREE.DirectionalLight(0xffffff, 3.2);
keyLight.position.set(-1800, 1100, 3800);
keyLight.castShadow = true;
scene.add(keyLight);

const field = new THREE.Mesh(
  new THREE.PlaneGeometry(8192, 10240),
  new THREE.MeshStandardMaterial({ color: 0x0a2730, roughness: 0.68, metalness: 0.15 }),
);
field.rotation.x = -Math.PI / 2;
field.receiveShadow = true;
scene.add(field);

const centerLine = new THREE.Mesh(
  new THREE.PlaneGeometry(18, 8192),
  new THREE.MeshBasicMaterial({ color: 0x4fdcff, transparent: true, opacity: 0.55 }),
);
centerLine.rotation.x = -Math.PI / 2;
centerLine.rotation.z = Math.PI / 2;
centerLine.position.y = 1.5;
scene.add(centerLine);

const centerCircle = new THREE.Mesh(
  new THREE.RingGeometry(780, 792, 96),
  new THREE.MeshBasicMaterial({ color: 0x4fdcff, transparent: true, opacity: 0.48, side: THREE.DoubleSide }),
);
centerCircle.rotation.x = -Math.PI / 2;
centerCircle.position.y = 1.6;
scene.add(centerCircle);

const wallMaterial = new THREE.MeshStandardMaterial({
  color: 0x102b3a,
  roughness: 0.42,
  metalness: 0.38,
  transparent: true,
  opacity: 0.72,
});
for (const [width, depth, x, z] of [
  [64, 10240, -4096, 0],
  [64, 10240, 4096, 0],
  [8192, 64, 0, -5120],
  [8192, 64, 0, 5120],
] as const) {
  const wall = new THREE.Mesh(new THREE.BoxGeometry(width, 700, depth), wallMaterial);
  wall.position.set(x, 350, z);
  wall.receiveShadow = true;
  scene.add(wall);
}

const ballMesh = new THREE.Mesh(
  new THREE.IcosahedronGeometry(BALL.radius.value, 4),
  new THREE.MeshStandardMaterial({
    color: 0xeaf8ff,
    roughness: 0.28,
    metalness: 0.32,
    emissive: 0x0a3044,
    emissiveIntensity: 0.8,
  }),
);
ballMesh.castShadow = true;
scene.add(ballMesh);

const carGroup = new THREE.Group();
const chassis = new THREE.Mesh(
  new THREE.BoxGeometry(CAR.hitboxWidth.value, CAR.hitboxHeight.value, CAR.hitboxLength.value),
  new THREE.MeshStandardMaterial({ color: 0x1ea7d7, roughness: 0.24, metalness: 0.72 }),
);
chassis.castShadow = true;
carGroup.add(chassis);

const cabin = new THREE.Mesh(
  new THREE.BoxGeometry(62, 24, 54),
  new THREE.MeshStandardMaterial({ color: 0x07121b, roughness: 0.16, metalness: 0.5 }),
);
cabin.position.set(0, 24, 2);
cabin.castShadow = true;
carGroup.add(cabin);

const wheelGeometry = new THREE.CylinderGeometry(15, 15, 9, 18);
const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x05070a, roughness: 0.9 });
for (const [x, z] of [
  [-48, -38],
  [48, -38],
  [-48, 38],
  [48, 38],
] as const) {
  const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
  wheel.rotation.z = Math.PI / 2;
  wheel.position.set(x, -10, z);
  wheel.castShadow = true;
  carGroup.add(wheel);
}
scene.add(carGroup);

const simulation = new GameSimulation();
simulation.setBall({ x: 0, y: 0, z: BALL.radius.value }, { x: 0, y: 0, z: 0 });

const keys = new Set<string>();
let ballCamera = true;
let sequence = 0;
let lastFrameTime = performance.now();
let lastCameraToggle = false;

addEventListener('keydown', (event) => {
  keys.add(event.code);
  if (event.code === 'Space' || event.code === 'Tab') event.preventDefault();
  if (event.code === 'KeyR') resetPlayfield();
});
addEventListener('keyup', (event) => keys.delete(event.code));
addEventListener('blur', () => keys.clear());

function axis(negative: string, positive: string): number {
  return (keys.has(positive) ? 1 : 0) - (keys.has(negative) ? 1 : 0);
}

function gamepadInput(): Partial<PlayerInputFrame> {
  const pad = navigator.getGamepads().find((candidate) => candidate?.connected);
  if (!pad) return {};
  const steer = applyDeadzone(pad.axes[0] ?? 0, 0.12);
  const vertical = applyDeadzone(pad.axes[1] ?? 0, 0.12);
  const leftTrigger = pad.buttons[6]?.value ?? 0;
  const rightTrigger = pad.buttons[7]?.value ?? 0;
  return {
    throttle: rightTrigger - leftTrigger,
    steer,
    pitch: vertical,
    yaw: steer,
    roll: (pad.buttons[5]?.pressed ? 1 : 0) - (pad.buttons[4]?.pressed ? 1 : 0),
    jump: pad.buttons[0]?.pressed ?? false,
    boost: pad.buttons[1]?.pressed ?? false,
    handbrake: pad.buttons[2]?.pressed ?? false,
  };
}

function sampleInput(): PlayerInputFrame {
  const pad = gamepadInput();
  const keyboardThrottle = axis('KeyS', 'KeyW');
  const keyboardSteer = axis('KeyA', 'KeyD');
  const keyboardPitch = axis('KeyW', 'KeyS');
  const togglePressed =
    keys.has('KeyC') || navigator.getGamepads().some((item) => item?.buttons[3]?.pressed);
  if (togglePressed && !lastCameraToggle) ballCamera = !ballCamera;
  lastCameraToggle = togglePressed;

  sequence += 1;
  const tick = simulation.getState().tick;
  return {
    sequence,
    tick,
    throttle: pad.throttle ?? keyboardThrottle,
    steer: pad.steer ?? keyboardSteer,
    pitch: pad.pitch ?? keyboardPitch,
    yaw: pad.yaw ?? keyboardSteer,
    roll: pad.roll ?? axis('KeyQ', 'KeyE'),
    jump: pad.jump ?? keys.has('Space'),
    boost: pad.boost ?? (keys.has('ShiftLeft') || keys.has('ShiftRight')),
    handbrake: pad.handbrake ?? (keys.has('ControlLeft') || keys.has('ControlRight')),
    ballCam: ballCamera,
  };
}

function applyDeadzone(value: number, deadzone: number): number {
  if (Math.abs(value) <= deadzone) return 0;
  return Math.sign(value) * ((Math.abs(value) - deadzone) / (1 - deadzone));
}

function resetPlayfield(): void {
  simulation.setCar(
    { x: 0, y: -1200, z: CAR.hitboxHeight.value * 0.5 },
    { x: 0, y: 0, z: 0 },
    0,
  );
  simulation.setBall({ x: 0, y: 0, z: BALL.radius.value }, { x: 0, y: 0, z: 0 });
}

const runner = new FixedStepRunner(() => simulation.step(sampleInput()));
const cameraTarget = new THREE.Vector3();
const desiredCamera = new THREE.Vector3();
const lookTarget = new THREE.Vector3();

function frame(now: number): void {
  const elapsed = Math.min(0.1, (now - lastFrameTime) / 1000);
  lastFrameTime = now;
  const stats = runner.advance(elapsed);
  const interpolated = simulation.interpolate(stats.alpha);
  const state = simulation.getState();

  ballMesh.position.set(
    interpolated.ballPosition.x,
    interpolated.ballPosition.z,
    -interpolated.ballPosition.y,
  );
  carGroup.position.set(
    interpolated.carPosition.x,
    interpolated.carPosition.z,
    -interpolated.carPosition.y,
  );
  carGroup.rotation.order = 'YXZ';
  carGroup.rotation.set(-interpolated.carPitch, -interpolated.carYaw, interpolated.carRoll);

  const forwardX = Math.sin(interpolated.carYaw);
  const forwardY = Math.cos(interpolated.carYaw);
  desiredCamera.set(
    interpolated.carPosition.x - forwardX * 780,
    interpolated.carPosition.z + 310,
    -interpolated.carPosition.y + forwardY * 780,
  );
  const cameraBlend = 1 - Math.exp(-elapsed * 8.5);
  camera.position.lerp(desiredCamera, cameraBlend);

  if (ballCamera) {
    lookTarget.set(
      interpolated.ballPosition.x,
      interpolated.ballPosition.z,
      -interpolated.ballPosition.y,
    );
  } else {
    lookTarget.set(
      interpolated.carPosition.x + forwardX * 500,
      interpolated.carPosition.z + 80,
      -interpolated.carPosition.y - forwardY * 500,
    );
  }
  cameraTarget.lerp(lookTarget, 1 - Math.exp(-elapsed * 11));
  camera.lookAt(cameraTarget);

  const speed = Math.hypot(
    state.car.linearVelocity.x,
    state.car.linearVelocity.y,
    state.car.linearVelocity.z,
  );
  const speedElement = document.querySelector<HTMLElement>('#speed');
  const boostElement = document.querySelector<HTMLElement>('#boost-value');
  const stateElement = document.querySelector<HTMLElement>('#state');
  if (speedElement) speedElement.textContent = `${Math.round(speed * 0.036)} KM/H`;
  if (boostElement) boostElement.textContent = String(Math.round(state.car.boost));
  if (stateElement) {
    stateElement.textContent = state.car.supersonic
      ? 'SUPERSONIC'
      : state.car.grounded
        ? 'GROUNDED'
        : 'AIRBORNE';
  }

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
