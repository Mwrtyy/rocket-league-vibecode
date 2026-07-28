from pathlib import Path


def replace_once(source: str, old: str, new: str, label: str) -> str:
    count = source.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one match, found {count}")
    return source.replace(old, new, 1)


path = Path("apps/client/src/main.ts")
source = path.read_text()
source = replace_once(
    source,
    "} from '@aether/simulation';\nimport './style.css';",
    "} from '@aether/simulation';\nimport { addArenaBoundaryVisuals } from './arena-visual.js';\nimport './style.css';",
    "arena visual import",
)
source = replace_once(
    source,
    """const wallMaterial = new THREE.MeshStandardMaterial({
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
""",
    """addArenaBoundaryVisuals(scene);
""",
    "legacy rectangular arena visuals",
)
path.write_text(source)
Path(__file__).unlink()
