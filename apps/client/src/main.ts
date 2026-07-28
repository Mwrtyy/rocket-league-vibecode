import * as THREE from 'three';
import {
  ARENA,
  BALL,
  BOOST_PAD_LAYOUT,
  CAR,
  FixedStepRunner,
  GameSimulation,
  createGameViewState,
  createInterpolatedGameState,
  type PlayerInputFrame,
} from '@aether/simulation';
import './style.css';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Missing #app root.');

app.innerHTML = `
  <div class="hud">
    <header class="topbar">
      <div class="brand">AETHER STRIKE</div>
      <div class="mode">SOLO MATCH · LOCAL 120 HZ</div>
    </header>
    <div class="scoreboard">
      <strong id="blue-score" class="team-score blue">0</strong>
      <div class="match-time"><strong id="clock">5:00</strong><small id="phase">KICKOFF</small></div>
      <strong id="orange-score" class="team-score orange">0</strong>
    </div>
    <div id="announcement" class="announcement" aria-live="polite"></div>
    <div class="telemetry"><span id="speed">0 KM/H</span><span id="state">GROUNDED</span></div>
    <div class="boost"><span id="boost-value">33</span><small>BOOST</small></div>
    <div class="controls">WASD drive · Space jump/dodge · Shift boost · Ctrl powerslide · C ball camera · R restart</div>
  </div>`;

const speedElement = document.querySelector<HTMLElement>('#speed');
const boostElement = document.querySelector<HTMLElement>('#boost-value');
const stateElement = document.querySelector<HTMLElement>('#state');
const blueScoreElement = document.querySelector<HTMLElement>('#blue-score');
const orangeScoreElement = document.querySelector<HTMLElement>('#orange-score');
const clockElement = document.querySelector<HTMLElement>('#clock');
const phaseElement = document.querySelector<HTMLElement>('#phase');
const announcementElement = document.querySelector<HTMLElement>('#announcement');

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
  new THREE.MeshBasicMaterial({
    color: 0x4fdcff,
    transparent: true,
    opacity: 0.48,
    side: THREE.DoubleSide,
  }),
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
for (const x of [-4096, 4096]) {
  const wall = new THREE.Mesh(new THREE.BoxGeometry(64, 700, 10240), wallMaterial);
  wall.position.set(x, 350, 0);
  wall.receiveShadow = true;
  scene.add(wall);
}

const goalSideWidth = (8192 - ARENA.goalHalfWidth.value * 2) * 0.5;
const goalTopHeight = 700 - ARENA.goalHeight.value;
for (const z of [-5120, 5120]) {
  for (const side of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(goalSideWidth, 700, 64), wallMaterial);
    wall.position.set(side * (ARENA.goalHalfWidth.value + goalSideWidth * 0.5), 350, z);
    scene.add(wall);
  }
  const top = new THREE.Mesh(
    new THREE.BoxGeometry(ARENA.goalHalfWidth.value * 2, goalTopHeight, 64),
    wallMaterial,
  );
  top.position.set(0, ARENA.goalHeight.value + goalTopHeight * 0.5, z);
  scene.add(top);

  const goalFloor = new THREE.Mesh(
    new THREE.PlaneGeometry(ARENA.goalHalfWidth.value * 2, ARENA.goalDepth.value),
    new THREE.MeshStandardMaterial({ color: 0x071821, roughness: 0.8, metalness: 0.1 }),
  );
  goalFloor.rotation.x = -Math.PI / 2;
  goalFloor.position.set(0, 1, z + Math.sign(z) * ARENA.goalDepth.value * 0.5);
  scene.add(goalFloor);
}

const padMeshes = BOOST_PAD_LAYOUT.map((pad) => {
  const radius = pad.isLarge ? 92 : 55;
  const material = new THREE.MeshStandardMaterial({
    color: pad.isLarge ? 0xffaa2b : 0x68dfff,
    emissive: pad.isLarge ? 0xff6a00 : 0x1eb6e8,
    emissiveIntensity: pad.isLarge ? 2.2 : 1.35,
    roughness: 0.32,
    metalness: 0.5,
    transparent: true,
    opacity: 0.95,
  });
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 9, 32), material);
  mesh.position.set(pad.position.x, 5, -pad.position.y);
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
});

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

const simulation = new GameSimulation(undefined, { matchMode: true });
const interpolatedState = createInterpolatedGameState();
const viewState = createGameViewState();
const sampledInput: PlayerInputFrame = {
  sequence: 0,
  tick: 0,
  throttle: 0,
  steer: 0,
  pitch: 0,
  yaw: 0,
  roll: 0,
  jump: false,
  boost: false,
  handbrake: false,
  ballCam: true,
};
const keys = new Set<string>();
let ballCamera = true;
let sequence = 0;
let lastFrameTime = performance.now();
let lastCameraToggle = false;

addEventListener('keydown', (event) => {
  keys.add(event.code);
  if (event.code === 'Space' || event.code === 'Tab') event.preventDefault();
  if (event.code === 'KeyR') simulation.resetMatch();
});
addEventListener('keyup', (event) => keys.delete(event.code));
addEventListener('blur', () => keys.clear());

function axis(negative: string, positive: string): number {
  return (keys.has(positive) ? 1 : 0) - (keys.has(negative) ? 1 : 0);
}

function findConnectedGamepad(): Gamepad | null {
  const gamepads = navigator.getGamepads();
  for (let index = 0; index < gamepads.length; index += 1) {
    const candidate = gamepads[index];
    if (candidate?.connected) return candidate;
  }
  return null;
}

function sampleInput(): PlayerInputFrame {
  const pad = findConnectedGamepad();
  const keyboardThrottle = axis('KeyS', 'KeyW');
  const keyboardSteer = axis('KeyA', 'KeyD');
  const keyboardPitch = axis('KeyW', 'KeyS');
  const steer = pad === null ? keyboardSteer : applyDeadzone(pad.axes[0] ?? 0, 0.12);
  const vertical = pad === null ? keyboardPitch : applyDeadzone(pad.axes[1] ?? 0, 0.12);
  const togglePressed = keys.has('KeyC') || (pad?.buttons[3]?.pressed ?? false);
  if (togglePressed && !lastCameraToggle) ballCamera = !ballCamera;
  lastCameraToggle = togglePressed;

  sequence += 1;
  sampledInput.sequence = sequence;
  sampledInput.tick = simulation.getTick();
  sampledInput.throttle =
    pad === null ? keyboardThrottle : (pad.buttons[7]?.value ?? 0) - (pad.buttons[6]?.value ?? 0);
  sampledInput.steer = steer;
  sampledInput.pitch = vertical;
  sampledInput.yaw = steer;
  sampledInput.roll =
    pad === null
      ? axis('KeyQ', 'KeyE')
      : (pad.buttons[5]?.pressed ? 1 : 0) - (pad.buttons[4]?.pressed ? 1 : 0);
  sampledInput.jump = pad === null ? keys.has('Space') : (pad.buttons[0]?.pressed ?? false);
  sampledInput.boost =
    pad === null
      ? keys.has('ShiftLeft') || keys.has('ShiftRight')
      : (pad.buttons[1]?.pressed ?? false);
  sampledInput.handbrake =
    pad === null
      ? keys.has('ControlLeft') || keys.has('ControlRight')
      : (pad.buttons[2]?.pressed ?? false);
  sampledInput.ballCam = ballCamera;
  return sampledInput;
}

function applyDeadzone(value: number, deadzone: number): number {
  if (Math.abs(value) <= deadzone) return 0;
  return Math.sign(value) * ((Math.abs(value) - deadzone) / (1 - deadzone));
}

function formatClock(seconds: number): string {
  const total = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(total / 60);
  return `${minutes}:${String(total % 60).padStart(2, '0')}`;
}

const runner = new FixedStepRunner(() => simulation.step(sampleInput()));
const cameraTarget = new THREE.Vector3();
const desiredCamera = new THREE.Vector3();
const lookTarget = new THREE.Vector3();

function frame(now: number): void {
  const elapsed = Math.min(0.1, (now - lastFrameTime) / 1000);
  lastFrameTime = now;
  const stats = runner.advance(elapsed);
  const interpolated = simulation.interpolate(stats.alpha, interpolatedState);
  simulation.writeViewState(viewState);

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

  for (let padId = 0; padId < padMeshes.length; padId += 1) {
    const mesh = padMeshes[padId];
    if (mesh === undefined) continue;
    const active = viewState.boostPadActive[padId] === 1;
    mesh.visible = active;
    if (active) {
      const pulse = 1 + Math.sin(now * 0.004 + padId) * 0.04;
      mesh.scale.set(pulse, 1, pulse);
    }
  }

  const forwardX = Math.sin(interpolated.carYaw);
  const forwardY = Math.cos(interpolated.carYaw);
  desiredCamera.set(
    interpolated.carPosition.x - forwardX * 780,
    interpolated.carPosition.z + 310,
    -interpolated.carPosition.y + forwardY * 780,
  );
  camera.position.lerp(desiredCamera, 1 - Math.exp(-elapsed * 8.5));

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

  if (speedElement) speedElement.textContent = `${Math.round(viewState.carSpeed * 0.036)} KM/H`;
  if (boostElement) boostElement.textContent = String(Math.round(viewState.carBoost));
  if (stateElement) {
    stateElement.textContent = viewState.carSupersonic
      ? 'SUPERSONIC'
      : viewState.carGrounded
        ? 'GROUNDED'
        : 'AIRBORNE';
  }
  if (blueScoreElement) blueScoreElement.textContent = String(viewState.blueScore);
  if (orangeScoreElement) orangeScoreElement.textContent = String(viewState.orangeScore);
  if (clockElement) {
    clockElement.textContent =
      viewState.matchPhase === 'overtime' ? '+0:00' : formatClock(viewState.clockSeconds);
  }
  if (phaseElement) phaseElement.textContent = viewState.matchPhase.toUpperCase();
  if (announcementElement) {
    if (viewState.matchPhase === 'countdown') {
      announcementElement.textContent = String(Math.max(1, Math.ceil(viewState.countdownSeconds)));
      announcementElement.classList.add('visible');
    } else if (viewState.matchPhase === 'goal') {
      announcementElement.textContent = `${viewState.lastScorer?.toUpperCase() ?? ''} SCORES`;
      announcementElement.classList.add('visible');
    } else if (viewState.matchPhase === 'ended') {
      const winner = viewState.blueScore > viewState.orangeScore ? 'BLUE' : 'ORANGE';
      announcementElement.textContent = `${winner} WINS`;
      announcementElement.classList.add('visible');
    } else if (viewState.matchPhase === 'overtime') {
      announcementElement.textContent = 'OVERTIME';
      announcementElement.classList.add('visible');
    } else {
      announcementElement.textContent = '';
      announcementElement.classList.remove('visible');
    }
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
