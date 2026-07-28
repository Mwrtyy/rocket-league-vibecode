import * as THREE from 'three';
import { ARENA, ARENA_WALL_SEGMENTS, type ArenaWallSegment } from '@aether/simulation';

const WALL_HEIGHT = 700;
const WALL_THICKNESS = 42;
const CURVE_SUBDIVISIONS = 12;

export function addArenaBoundaryVisuals(scene: THREE.Scene): void {
  const wallMaterial = new THREE.MeshStandardMaterial({
    color: 0x102b3a,
    roughness: 0.42,
    metalness: 0.38,
    transparent: true,
    opacity: 0.78,
    side: THREE.DoubleSide,
  });
  const curveMaterial = new THREE.MeshStandardMaterial({
    color: 0x123343,
    roughness: 0.5,
    metalness: 0.28,
    side: THREE.DoubleSide,
  });

  for (const segment of ARENA_WALL_SEGMENTS) {
    scene.add(createVerticalWall(segment, wallMaterial));
    scene.add(createFloorCurve(segment, curveMaterial));
  }

  addGoalVisuals(scene, wallMaterial);
}

function createVerticalWall(segment: ArenaWallSegment, material: THREE.Material): THREE.Mesh {
  const deltaX = segment.endX - segment.startX;
  const deltaY = segment.endY - segment.startY;
  const length = Math.hypot(deltaX, deltaY);
  const curveRadius = ARENA.floorWallCurveRadius.value;
  const height = WALL_HEIGHT - curveRadius;
  const wall = new THREE.Mesh(new THREE.BoxGeometry(length, height, WALL_THICKNESS), material);
  wall.position.set(
    (segment.startX + segment.endX) * 0.5,
    curveRadius + height * 0.5,
    -(segment.startY + segment.endY) * 0.5,
  );
  wall.rotation.y = Math.atan2(deltaY, deltaX);
  wall.receiveShadow = true;
  return wall;
}

function createFloorCurve(segment: ArenaWallSegment, material: THREE.Material): THREE.Mesh {
  const curveRadius = ARENA.floorWallCurveRadius.value;
  const vertices = new Float32Array((CURVE_SUBDIVISIONS + 1) * 2 * 3);
  const indices: number[] = [];

  for (let subdivision = 0; subdivision <= CURVE_SUBDIVISIONS; subdivision += 1) {
    const interpolation = subdivision / CURVE_SUBDIVISIONS;
    const angle = -Math.PI * 0.5 - interpolation * Math.PI * 0.5;
    const inwardDistance = curveRadius + Math.cos(angle) * curveRadius;
    const height = curveRadius + Math.sin(angle) * curveRadius;
    const offset = subdivision * 6;

    vertices[offset] = segment.startX + segment.inwardNormalX * inwardDistance;
    vertices[offset + 1] = height;
    vertices[offset + 2] = -(segment.startY + segment.inwardNormalY * inwardDistance);
    vertices[offset + 3] = segment.endX + segment.inwardNormalX * inwardDistance;
    vertices[offset + 4] = height;
    vertices[offset + 5] = -(segment.endY + segment.inwardNormalY * inwardDistance);

    if (subdivision < CURVE_SUBDIVISIONS) {
      const first = subdivision * 2;
      indices.push(first, first + 2, first + 1, first + 1, first + 2, first + 3);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  return mesh;
}

function addGoalVisuals(scene: THREE.Scene, material: THREE.Material): void {
  const goalMaterial = new THREE.MeshStandardMaterial({
    color: 0x071821,
    roughness: 0.72,
    metalness: 0.15,
  });
  const openingWidth = ARENA.goalHalfWidth.value * 2;
  const depth = ARENA.goalDepth.value;
  const goalHeight = ARENA.goalHeight.value;

  for (const signY of [-1, 1] as const) {
    const backY = signY * ARENA.backWallY.value;
    const goalCenterY = backY + signY * depth * 0.5;
    const goalEndY = backY + signY * depth;

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(openingWidth, depth), goalMaterial);
    floor.rotation.x = -Math.PI * 0.5;
    floor.position.set(0, 0.8, -goalCenterY);
    floor.receiveShadow = true;
    scene.add(floor);

    const ceiling = new THREE.Mesh(
      new THREE.BoxGeometry(openingWidth, WALL_THICKNESS, depth),
      material,
    );
    ceiling.position.set(0, goalHeight, -goalCenterY);
    scene.add(ceiling);

    for (const signX of [-1, 1] as const) {
      const side = new THREE.Mesh(
        new THREE.BoxGeometry(WALL_THICKNESS, goalHeight, depth),
        material,
      );
      side.position.set(signX * ARENA.goalHalfWidth.value, goalHeight * 0.5, -goalCenterY);
      scene.add(side);
    }

    const back = new THREE.Mesh(
      new THREE.BoxGeometry(openingWidth, goalHeight, WALL_THICKNESS),
      material,
    );
    back.position.set(0, goalHeight * 0.5, -goalEndY);
    scene.add(back);

    const crossbarHeight = WALL_HEIGHT - goalHeight;
    const crossbar = new THREE.Mesh(
      new THREE.BoxGeometry(openingWidth, crossbarHeight, WALL_THICKNESS),
      material,
    );
    crossbar.position.set(0, goalHeight + crossbarHeight * 0.5, -backY);
    scene.add(crossbar);
  }
}
