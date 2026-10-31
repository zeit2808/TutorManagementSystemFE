import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { createStudents } from "./hero-students";

/*
 * Hero background, loaded lazily: a week timetable laid out as a floor that
 * recedes into the navy, populated with a small tutoring world built from
 * primitives (no model files to download).
 *
 * - A class session is a stack of textbooks with a pencil on top, rising on a
 *   free cell (never two on one cell).
 * - Now and then a second stack lands on a taken cell, flashes red and slides to
 *   a free one — the same no-overlap rule the back-end enforces.
 * - Mini students wander the floor, walk to a class while it runs and stand
 *   around it, then drift off when it ends.
 * - Arriving at class is attendance: a badge pops over the student's head — a
 *   green check when they made it on time, an amber clock when they were late.
 * - Every so often the alarm clock rings: sound rings ripple out, classes end
 *   together and a new set of classes begins (a shift change on the timetable).
 * - Hover near the students and they turn to wave; click one and it jumps.
 * - Graduation caps, open books, a globe, apples, pencils and paper planes float
 *   slowly in the air.
 * Illustrative only.
 */

const NAVY = 0x19184f;
const COLS = 15;
const ROWS = 14;
const CELL_X = 1.42;
const CELL_Z = 1.02;
const BOOK_COLORS = [0x5b4cf0, 0x2d6cdf, 0x12806a, 0x7b6ff5, 0xe0a63a, 0xd9576b];
const CLASH = 0xc33c4a;
const BLOCK_SLOTS = 16;
const STUDENTS = 24;
const BOOK_H = 0.17;

type Phase = "idle" | "rising" | "alive" | "sinking" | "clash" | "moving";

interface Book {
  group: THREE.Group;
  cover: THREE.MeshStandardMaterial;
}

interface Block {
  group: THREE.Group;
  books: Book[];
  pencil: THREE.Group;
  phase: Phase;
  t: number;
  life: number;
  cell: number;
  from: THREE.Vector3;
  to: THREE.Vector3;
  height: number;
  count: number;
}

interface Student {
  pos: THREE.Vector3;
  target: THREE.Vector3;
  heading: number;
  walk: number;
  /** 0…1 how much of the walk cycle is showing; eases in and out so steps never pop. */
  stride: number;
  seed: number;
  block: Block | null;
  slot: number;
  pause: number;
  raise: number;
  raiseFor: number;
  /** When the student was called to the current class, to judge on time vs late. */
  calledAt: number;
  arrived: boolean;
  /** Seconds since the attendance badge popped, or -1 when none is showing. */
  badgeT: number;
  late: boolean;
  wave: number;
  wavePhase: number;
  /** Seconds into a jump, or -1 on the ground. */
  jumpT: number;
}

interface Prop {
  object: THREE.Object3D;
  base: THREE.Vector3;
  spin: THREE.Vector3;
  seed: number;
}

const ease = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
const cellCenter = (cell: number, out = new THREE.Vector3()) =>
  out.set(((cell % COLS) - (COLS - 1) / 2) * CELL_X, 0, (Math.floor(cell / COLS) - ROWS + 3) * CELL_Z);
const pick = <T,>(items: T[]) => items[Math.floor(Math.random() * items.length)];
const rand = (min: number, max: number) => min + Math.random() * (max - min);

/* ───────── Shared materials & geometry ───────── */

function createKit() {
  const std = (color: number, extra: THREE.MeshStandardMaterialParameters = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.02, ...extra });
  return {
    pages: std(0xf6f1e4, { roughness: 0.9 }),
    pencilBody: std(0xf2c14e, { roughness: 0.5 }),
    wood: std(0xe8c39e, { roughness: 0.8 }),
    lead: std(0x2b2b38),
    eraser: std(0xf28b9b),
    ferrule: std(0xc9ccd8, { metalness: 0.6, roughness: 0.35 }),
    capBoard: std(0x1d1b45, { roughness: 0.7 }),
    tassel: std(0xf2c14e),
    ocean: std(0x2d6cdf, { roughness: 0.45 }),
    land: std(0x12806a, { roughness: 0.7 }),
    brass: std(0xc9a23a, { metalness: 0.55, roughness: 0.35 }),
    clockFace: std(0xffffff, { roughness: 0.5 }),
    clockBody: std(0xd9576b, { roughness: 0.45 }),
    apple: std(0xd23b48, { roughness: 0.4 }),
    leaf: std(0x3aa36b),
    paper: std(0xffffff, { roughness: 0.85, side: THREE.DoubleSide }),
    ruler: std(0xf5d77a, { roughness: 0.6 }),
    plate: new RoundedBoxGeometry(1.0, 0.03, 0.72, 2, 0.012),
    pagesGeo: new THREE.BoxGeometry(0.93, BOOK_H - 0.05, 0.66),
    spine: new THREE.BoxGeometry(0.04, BOOK_H, 0.72),
  };
}
type Kit = ReturnType<typeof createKit>;

function makeBook(kit: Kit): Book {
  const cover = new THREE.MeshStandardMaterial({ color: BOOK_COLORS[0], roughness: 0.5, metalness: 0.04 });
  const group = new THREE.Group();
  const top = new THREE.Mesh(kit.plate, cover);
  top.position.y = BOOK_H / 2 - 0.015;
  const bottom = new THREE.Mesh(kit.plate, cover);
  bottom.position.y = -BOOK_H / 2 + 0.015;
  const spine = new THREE.Mesh(kit.spine, cover);
  spine.position.x = -0.49;
  const pages = new THREE.Mesh(kit.pagesGeo, kit.pages);
  pages.position.x = 0.02;
  group.add(top, bottom, spine, pages);
  return { group, cover };
}

function makePencil(kit: Kit, length = 0.95) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, length, 6), kit.pencilBody);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.15, 6), kit.wood);
  tip.position.y = length / 2 + 0.075;
  const lead = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.05, 6), kit.lead);
  lead.position.y = length / 2 + 0.13;
  const ferrule = new THREE.Mesh(new THREE.CylinderGeometry(0.047, 0.047, 0.07, 12), kit.ferrule);
  ferrule.position.y = -length / 2 - 0.035;
  const eraser = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.044, 0.08, 12), kit.eraser);
  eraser.position.y = -length / 2 - 0.1;
  group.add(body, tip, lead, ferrule, eraser);
  return group;
}

function makeGradCap(kit: Kit) {
  const group = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.27, 0.2, 18), kit.capBoard);
  const board = new THREE.Mesh(new RoundedBoxGeometry(0.72, 0.04, 0.72, 2, 0.015), kit.capBoard);
  board.position.y = 0.12;
  board.rotation.y = Math.PI / 4;
  const button = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), kit.tassel);
  button.position.y = 0.15;
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.36, 4), kit.tassel);
  cord.position.set(0.2, 0.0, 0);
  cord.rotation.z = 0.25;
  const tassel = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.12, 8), kit.tassel);
  tassel.position.set(0.24, -0.2, 0);
  group.add(base, board, button, cord, tassel);
  return group;
}

function makeOpenBook(kit: Kit, color: number) {
  const group = new THREE.Group();
  const cover = new THREE.MeshStandardMaterial({ color, roughness: 0.5 });
  for (const side of [-1, 1]) {
    const half = new THREE.Group();
    const plate = new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.025, 0.7, 2, 0.01), cover);
    plate.position.x = side * 0.25;
    const pages = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.06, 0.64), kit.pages);
    pages.position.set(side * 0.24, 0.04, 0);
    half.add(plate, pages);
    half.rotation.z = side * -0.32;
    group.add(half);
  }
  return group;
}

function makeGlobe(kit: Kit) {
  const group = new THREE.Group();
  const globe = new THREE.Group();
  globe.add(new THREE.Mesh(new THREE.SphereGeometry(0.34, 24, 16), kit.ocean));
  // A few raised "continents" so the rotation reads.
  for (let i = 0; i < 7; i++) {
    const land = new THREE.Mesh(new THREE.SphereGeometry(rand(0.08, 0.15), 10, 8), kit.land);
    const phi = rand(0.5, 2.5);
    const theta = rand(0, Math.PI * 2);
    land.position.setFromSphericalCoords(0.29, phi, theta);
    land.scale.set(1, 0.5, 1);
    land.lookAt(0, 0, 0);
    globe.add(land);
  }
  globe.rotation.z = 0.4;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.015, 6, 40, Math.PI * 1.3), kit.brass);
  ring.rotation.set(0, Math.PI / 2, 0.4 + Math.PI / 2);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.22, 6), kit.brass);
  stem.position.y = -0.46;
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.05, 18), kit.brass);
  foot.position.y = -0.58;
  group.add(globe, ring, stem, foot);
  group.userData.spinner = globe;
  return group;
}

function makeClock(kit: Kit) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.14, 28), kit.clockBody);
  body.rotation.x = Math.PI / 2;
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.25, 28), kit.clockFace);
  face.position.z = 0.071;
  const hour = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.13, 0.01), kit.lead);
  hour.position.set(0, 0.05, 0.08);
  const minute = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.19, 0.01), kit.lead);
  minute.geometry.translate(0, 0.08, 0);
  minute.position.z = 0.085;
  const bells = [-1, 1].map((side) => {
    const bell = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), kit.brass);
    bell.position.set(side * 0.2, 0.28, 0);
    bell.rotation.z = side * -0.5;
    return bell;
  });
  const legs = [-1, 1].map((side) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.12, 6), kit.lead);
    leg.position.set(side * 0.17, -0.31, 0);
    leg.rotation.z = side * 0.4;
    return leg;
  });
  group.add(body, face, hour, minute, ...bells, ...legs);
  group.userData.minute = minute;
  return group;
}

function makeApple(kit: Kit) {
  const group = new THREE.Group();
  const fruit = new THREE.Mesh(new THREE.SphereGeometry(0.2, 18, 14), kit.apple);
  fruit.scale.set(1, 0.92, 1);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.015, 0.1, 5), kit.wood);
  stem.position.y = 0.21;
  const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), kit.leaf);
  leaf.scale.set(1.4, 0.3, 0.7);
  leaf.position.set(0.06, 0.24, 0);
  leaf.rotation.z = -0.5;
  group.add(fruit, stem, leaf);
  return group;
}

function makePaperPlane(kit: Kit) {
  const geometry = new THREE.BufferGeometry();
  // Nose at +z; two wings and a keel folded from one sheet.
  const v = [
    0, 0, 0.45, -0.32, 0.04, -0.3, 0, 0, -0.25,
    0, 0, 0.45, 0, 0, -0.25, 0.32, 0.04, -0.3,
    0, 0, 0.45, 0, -0.1, -0.25, 0, 0, -0.25,
  ];
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, kit.paper);
}

function makeRuler(kit: Kit) {
  return new THREE.Mesh(new RoundedBoxGeometry(1.1, 0.03, 0.16, 2, 0.01), kit.ruler);
}

/* ───────── Scene ───────── */

export function mountHeroScene(container: HTMLElement, options: { reduced: boolean; onReady: () => void }) {
  const { reduced } = options;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setClearColor(NAVY, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(NAVY, 9, 25);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 60);
  const cameraBase = new THREE.Vector3(0, 3.4, 9.5);
  const lookAt = new THREE.Vector3(0, 0.6, -2);

  scene.add(new THREE.HemisphereLight(0xc9c4ff, 0x0b0a2e, 1.25));
  const key = new THREE.DirectionalLight(0xffffff, 1.7);
  key.position.set(-6, 10, 6);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x8fb4ff, 0.6);
  rim.position.set(6, 4, -8);
  scene.add(rim);

  const kit = createKit();
  const board = new THREE.Group();
  scene.add(board);

  // Timetable floor: one instanced tile per cell.
  const tileGeometry = new RoundedBoxGeometry(CELL_X - 0.16, 0.05, CELL_Z - 0.16, 2, 0.04);
  const tileMaterial = new THREE.MeshStandardMaterial({ color: 0x2c2a7a, roughness: 0.85, metalness: 0, transparent: true, opacity: 0.62 });
  const tiles = new THREE.InstancedMesh(tileGeometry, tileMaterial, COLS * ROWS);
  const matrix = new THREE.Matrix4();
  const scratch = new THREE.Vector3();
  for (let cell = 0; cell < COLS * ROWS; cell++) {
    cellCenter(cell, scratch);
    matrix.makeTranslation(scratch.x, -0.025, scratch.z);
    tiles.setMatrixAt(cell, matrix);
  }
  board.add(tiles);

  /* Classes: book stacks with a pencil on top. */
  const occupied = new Set<number>();
  const blocks: Block[] = Array.from({ length: BLOCK_SLOTS }, () => {
    const group = new THREE.Group();
    const books = Array.from({ length: 4 }, () => makeBook(kit));
    books.forEach((book) => group.add(book.group));
    const pencil = makePencil(kit);
    pencil.rotation.z = Math.PI / 2;
    group.add(pencil);
    group.visible = false;
    board.add(group);
    return { group, books, pencil, phase: "idle" as Phase, t: Math.random() * 3, life: 0, cell: -1, from: new THREE.Vector3(), to: new THREE.Vector3(), height: 0.5, count: 3 };
  });

  const freeCell = (near?: number) => {
    for (let attempt = 0; attempt < 40; attempt++) {
      const cell = near !== undefined
        ? near + [-1, 1, -COLS, COLS, -2, 2][attempt % 6]
        : Math.floor(Math.random() * COLS * ROWS);
      if (cell >= 0 && cell < COLS * ROWS && !occupied.has(cell) && Math.abs((cell % COLS) - (near ?? cell) % COLS) <= 2) return cell;
    }
    return -1;
  };

  const tint = (block: Block, hex: number | null, glow: number) => {
    block.books.forEach((book) => {
      if (hex !== null) book.cover.color.setHex(hex);
      book.cover.emissive.copy(book.cover.color).multiplyScalar(glow);
    });
  };

  const arrange = (block: Block) => {
    block.count = 2 + Math.floor(Math.random() * 3);
    block.books.forEach((book, index) => {
      const shown = index < block.count;
      book.group.visible = shown;
      if (!shown) return;
      book.group.position.set(rand(-0.05, 0.05), BOOK_H / 2 + index * BOOK_H, rand(-0.04, 0.04));
      book.group.rotation.y = rand(-0.22, 0.22);
      book.cover.color.setHex(pick(BOOK_COLORS));
      book.cover.emissive.copy(book.cover.color).multiplyScalar(0.18);
    });
    block.height = block.count * BOOK_H;
    block.pencil.position.set(0, block.height + 0.05, rand(-0.12, 0.12));
    block.pencil.rotation.set(0, rand(-0.6, 0.6), Math.PI / 2);
  };

  const spawn = (block: Block, clashOn?: Block) => {
    const cell = clashOn ? clashOn.cell : freeCell();
    if (cell < 0) return;
    arrange(block);
    block.cell = cell;
    block.t = 0;
    block.life = rand(10, 20);
    cellCenter(cell, block.to);
    block.from.copy(block.to);
    block.group.position.copy(block.to);
    block.group.rotation.y = rand(-0.3, 0.3);
    block.group.visible = true;
    if (clashOn) {
      block.phase = "clash";
      tint(block, CLASH, 0.4);
      block.group.position.y = clashOn.height + 2;
      block.group.scale.setScalar(1);
    } else {
      occupied.add(cell);
      block.phase = "rising";
    }
  };

  /* Students: chibi figures in school uniform (see hero-students.ts). */
  const rig = createStudents(board, STUDENTS);
  const color = new THREE.Color();

  const randomSpot = (out: THREE.Vector3) => out.set(rand(-8, 8), 0, rand(-7, 2.4));
  const students: Student[] = Array.from({ length: STUDENTS }, () => {
    const pos = randomSpot(new THREE.Vector3());
    return { pos, target: randomSpot(new THREE.Vector3()), heading: rand(0, Math.PI * 2), walk: 0, stride: 0, seed: Math.random() * 100, block: null, slot: 0, pause: rand(0, 2), raise: 0, raiseFor: 0, calledAt: 0, arrived: false, badgeT: -1, late: false, wave: 0, wavePhase: 0, jumpT: -1 };
  });

  const gather = (block: Block) => {
    const center = block.to;
    const nearest = students
      .filter((student) => !student.block)
      .sort((a, b) => a.pos.distanceToSquared(center) - b.pos.distanceToSquared(center))
      .slice(0, 3 + Math.floor(Math.random() * 3));
    nearest.forEach((student, slot) => {
      student.block = block;
      student.slot = slot / nearest.length;
      student.calledAt = clock;
      student.arrived = false;
    });
  };
  const release = (block: Block) => students.forEach((student) => {
    if (student.block !== block) return;
    student.block = null;
    randomSpot(student.target);
    student.pause = rand(0, 1);
  });

  /* Floating props. */
  const props: Prop[] = [];
  const addProp = (object: THREE.Object3D, x: number, y: number, z: number, scale = 1) => {
    object.scale.setScalar(scale);
    object.position.set(x, y, z);
    object.rotation.set(rand(-0.3, 0.3), rand(0, Math.PI * 2), rand(-0.3, 0.3));
    board.add(object);
    props.push({ object, base: new THREE.Vector3(x, y, z), spin: new THREE.Vector3(rand(-0.15, 0.15), rand(0.15, 0.4) * (Math.random() < 0.5 ? -1 : 1), rand(-0.1, 0.1)), seed: Math.random() * 100 });
  };
  addProp(makeGradCap(kit), -5.6, 3.6, -4.5, 1.2);
  addProp(makeGradCap(kit), 6.4, 4.4, -7, 1.1);
  addProp(makeOpenBook(kit, 0x5b4cf0), 4.6, 3.1, -2.6, 1.15);
  addProp(makeOpenBook(kit, 0x12806a), -7.4, 4.6, -8.5, 1.2);
  addProp(makeGlobe(kit), 7.2, 2.6, -4.2, 1.1);
  const bell = makeClock(kit);
  addProp(bell, -4.4, 2.5, -1.2, 1);
  addProp(makeApple(kit), 3.1, 4.6, -6.5, 1.1);
  addProp(makeApple(kit), -2.9, 4.9, -9, 1);
  addProp(makePencil(kit, 1.2), -6.8, 2.2, -2.8, 1);
  addProp(makePencil(kit, 1.2), 5.6, 4.9, -10, 1);
  addProp(makeRuler(kit), 8.2, 3.8, -9.5, 1.1);
  const planes = [makePaperPlane(kit), makePaperPlane(kit)];
  planes.forEach((plane) => board.add(plane));

  let clashTimer = 4;
  /** Scene time in seconds, for timestamps taken outside `step`'s arguments. */
  let clock = 0;

  // Bell: the alarm clock rings, ripples spread from it, and the timetable changes shift.
  const rings = Array.from({ length: 3 }, () => {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.42, 0.022, 8, 48),
      new THREE.MeshBasicMaterial({ color: 0xc9c4ff, transparent: true, opacity: 0, depthWrite: false }),
    );
    ring.visible = false;
    board.add(ring);
    return ring;
  });
  let bellTimer = 9;
  let ringT = -1;
  const BELL_RING = 1.6;

  function ringBell() {
    ringT = 0;
    bellTimer = rand(15, 20);
  }

  /** Shift change: every running class wraps up within a moment, and the next ones arrive soon after. */
  function changeShift() {
    for (const block of blocks) {
      if (block.phase === "alive") block.life = block.t + rand(0.1, 0.9);
      else if (block.phase === "idle") block.t = Math.min(block.t, -rand(1.2, 2.4));
    }
  }

  // Pointer in the floor's space: students nearby turn and wave; a click makes the nearest one jump.
  const raycaster = new THREE.Raycaster();
  const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const ndc = new THREE.Vector2();
  const hover = { active: false, point: new THREE.Vector3() };
  const facing = new THREE.Quaternion();
  const boardInverse = new THREE.Quaternion();

  function floorPoint(clientX: number, clientY: number, out: THREE.Vector3) {
    const rect = container.getBoundingClientRect();
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return false;
    ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    if (!raycaster.ray.intersectPlane(floorPlane, out)) return false;
    board.worldToLocal(out);
    return true;
  }

  function step(dt: number, time: number) {
    for (const block of blocks) {
      block.t += dt;
      const group = block.group;
      switch (block.phase) {
        case "idle":
          if (block.t > 0) spawn(block);
          break;
        case "rising": {
          // Drops in from above and settles on its cell.
          const k = ease(block.t / 0.9);
          group.position.y = (1 - k) * 2.4;
          group.scale.setScalar(0.55 + 0.45 * k);
          if (block.t >= 0.9) {
            block.phase = "alive";
            block.t = 0;
            gather(block);
          }
          break;
        }
        case "alive":
          group.position.y = 0;
          if (block.t >= block.life) {
            block.phase = "sinking";
            block.t = 0;
            release(block);
          }
          break;
        case "sinking": {
          const k = 1 - ease(block.t / 0.6);
          group.scale.setScalar(Math.max(0.001, k));
          if (block.t >= 0.6) {
            occupied.delete(block.cell);
            group.visible = false;
            block.phase = "idle";
            block.t = -rand(0.5, 3);
          }
          break;
        }
        case "clash": {
          // Lands on a class already in that cell and is refused: pulses red, then looks for a free cell nearby.
          const host = blocks.find((other) => other !== block && other.cell === block.cell && other.phase === "alive");
          const rest = (host?.height ?? 0) + 0.35;
          group.position.y = THREE.MathUtils.lerp(group.position.y, rest, 1 - Math.exp(-dt * 7));
          tint(block, null, 0.3 + 0.25 * Math.sin(block.t * 14));
          if (block.t >= 1.2) {
            const target = freeCell(block.cell);
            if (target < 0) {
              group.visible = false;
              block.phase = "idle";
              block.t = -2;
              break;
            }
            block.cell = target;
            occupied.add(target);
            block.from.copy(group.position);
            cellCenter(target, block.to);
            block.phase = "moving";
            block.t = 0;
          }
          break;
        }
        case "moving": {
          const k = ease(block.t / 0.9);
          group.position.x = THREE.MathUtils.lerp(block.from.x, block.to.x, k);
          group.position.z = THREE.MathUtils.lerp(block.from.z, block.to.z, k);
          group.position.y = THREE.MathUtils.lerp(block.from.y, 0, k) + Math.sin(k * Math.PI) * 0.4;
          block.books.forEach((book, index) => {
            book.cover.color.setHex(CLASH).lerp(color.setHex(BOOK_COLORS[(index + 2) % BOOK_COLORS.length]), k);
            book.cover.emissive.copy(book.cover.color).multiplyScalar(0.18 + (1 - k) * 0.2);
          });
          if (block.t >= 0.9) {
            block.phase = "alive";
            block.t = 0;
            gather(block);
          }
          break;
        }
      }
    }

    clock = time;
    bellTimer -= dt;
    if (bellTimer <= 0 && ringT < 0) ringBell();
    if (ringT >= 0) {
      const before = ringT;
      ringT += dt;
      if (before < 0.9 && ringT >= 0.9) changeShift();
      rings.forEach((ring, index) => {
        const k = (ringT - index * 0.28) / 1.1;
        ring.visible = k > 0 && k < 1;
        if (!ring.visible) return;
        ring.position.copy(bell.position);
        ring.quaternion.copy(facing);
        ring.scale.setScalar(0.6 + ease(k) * 2.6);
        (ring.material as THREE.MeshBasicMaterial).opacity = 0.75 * (1 - k);
      });
      if (ringT > BELL_RING + 0.6) {
        ringT = -1;
        rings.forEach((ring) => (ring.visible = false));
      }
    }

    clashTimer -= dt;
    if (clashTimer <= 0) {
      clashTimer = rand(6, 10);
      const host = blocks.find((block) => block.phase === "alive" && block.t < block.life - 3);
      const free = blocks.find((block) => block.phase === "idle");
      if (host && free) spawn(free, host);
    }

    // Badges and rings face the camera; they live under the (gently swaying) board, so undo its rotation.
    boardInverse.copy(board.quaternion).invert();
    facing.copy(boardInverse).multiply(camera.quaternion);
    rig.face(facing);

    students.forEach((student, index) => {
      if (student.block) {
        const block = student.block;
        const angle = student.slot * Math.PI * 2 + block.group.rotation.y;
        student.target.set(block.group.position.x + Math.cos(angle) * 0.95, 0, block.group.position.z + Math.sin(angle) * 0.72);
      }
      const dx = student.target.x - student.pos.x;
      const dz = student.target.z - student.pos.z;
      const distance = Math.hypot(dx, dz);
      let moving = false;
      if (student.pause > 0) {
        student.pause -= dt;
      } else if (distance > 0.04) {
        const speed = student.block ? 1.15 : 0.55;
        const stride = Math.min(distance, speed * dt);
        student.pos.x += (dx / distance) * stride;
        student.pos.z += (dz / distance) * stride;
        const want = Math.atan2(dx, dz);
        student.heading += Math.atan2(Math.sin(want - student.heading), Math.cos(want - student.heading)) * (1 - Math.exp(-dt * 8));
        moving = true;
      } else if (student.block) {
        // At class: turn to face the books.
        const want = Math.atan2(student.block.group.position.x - student.pos.x, student.block.group.position.z - student.pos.z);
        student.heading += Math.atan2(Math.sin(want - student.heading), Math.cos(want - student.heading)) * (1 - Math.exp(-dt * 5));
        if (!student.arrived) {
          // Attendance: whoever needed longer than a short walk to get here is marked late.
          student.arrived = true;
          student.late = time - student.calledAt > 2.6;
          student.badgeT = 0;
        }
      } else {
        randomSpot(student.target);
        student.pause = rand(0.8, 3);
      }
      student.stride += ((moving ? 1 : 0) - student.stride) * (1 - Math.exp(-dt * 10));
      if (moving) student.walk += dt * (student.block ? 10 : 7.5);

      // At class, now and then a hand goes up to ask a question.
      const settled = student.block && !moving && student.pause <= 0;
      if (settled && student.raiseFor <= 0 && Math.random() < dt * 0.09) student.raiseFor = rand(1.4, 2.4);
      if (student.raiseFor > 0) student.raiseFor -= dt;
      const raising = settled && student.raiseFor > 0;
      student.raise += ((raising ? 1 : 0) - student.raise) * (1 - Math.exp(-dt * 7));

      // Hover: students standing near the cursor turn toward it and wave; wanderers stop to do it.
      const near = hover.active && !moving && Math.hypot(hover.point.x - student.pos.x, hover.point.z - student.pos.z) < 1.9;
      if (near) {
        const want = Math.atan2(hover.point.x - student.pos.x, hover.point.z - student.pos.z);
        student.heading += Math.atan2(Math.sin(want - student.heading), Math.cos(want - student.heading)) * (1 - Math.exp(-dt * 6));
        if (!student.block) student.pause = Math.max(student.pause, 0.6);
      }
      student.wave += ((near ? 1 : 0) - student.wave) * (1 - Math.exp(-dt * 6));
      student.wavePhase += dt * 11;

      // Attendance badge: pops in with a little overshoot, holds, then shrinks away.
      let badge = 0;
      if (student.badgeT >= 0) {
        student.badgeT += dt;
        const t = student.badgeT;
        badge = t < 0.35 ? ease(t / 0.35) * (1 + 0.25 * Math.sin((t / 0.35) * Math.PI)) : t < 2.6 ? 1 : 1 - ease((t - 2.6) / 0.35);
        if (t > 2.95) student.badgeT = -1;
      }

      // Jump: a hop with a full spin, landing where it started.
      let lift = 0;
      let spin = 0;
      if (student.jumpT >= 0) {
        student.jumpT += dt;
        const k = student.jumpT / 0.7;
        lift = Math.sin(Math.min(1, k) * Math.PI) * 0.5;
        spin = ease(k) * Math.PI * 2;
        if (k >= 1) student.jumpT = -1;
      }

      const phase = Math.sin(student.walk);
      rig.update(index, {
        x: student.pos.x,
        z: student.pos.z,
        heading: student.heading + spin,
        bob: Math.abs(phase) * 0.045 * student.stride + Math.sin(time * 1.7 + student.seed) * 0.006,
        swing: phase * student.stride,
        raise: student.raise,
        // Looks up at the books while at class; a small nod in step when walking.
        tilt: settled ? -0.12 + student.raise * -0.1 : Math.abs(phase) * 0.05 * student.stride,
        lift,
        wave: student.wave * (1 - student.raise),
        wavePhase: student.wavePhase,
        badge,
        late: student.late,
      });
    });
    rig.commit();

    props.forEach((prop) => {
      prop.object.rotation.x += prop.spin.x * dt;
      prop.object.rotation.y += prop.spin.y * dt;
      prop.object.rotation.z = Math.sin(time * 0.4 + prop.seed) * 0.2;
      prop.object.position.y = prop.base.y + Math.sin(time * 0.6 + prop.seed) * 0.25;
      const spinner = prop.object.userData.spinner as THREE.Object3D | undefined;
      if (spinner) spinner.rotation.y += dt * 0.8;
      const minute = prop.object.userData.minute as THREE.Object3D | undefined;
      if (minute) minute.rotation.z = -time * 1.2;
    });
    if (ringT >= 0 && ringT < BELL_RING) {
      const fade = 1 - ringT / BELL_RING;
      bell.rotation.z = Math.sin(ringT * 48) * 0.28 * fade;
      bell.scale.setScalar(1 + Math.sin(ringT * 24) * 0.04 * fade);
    } else {
      bell.scale.setScalar(1);
    }

    // Paper planes glide across on long loops, banking as they turn.
    planes.forEach((plane, index) => {
      const speed = 0.16 + index * 0.05;
      const a = time * speed + index * Math.PI;
      const radiusX = 7 - index * 1.5;
      plane.position.set(Math.cos(a) * radiusX, 3.2 + index * 1.1 + Math.sin(a * 2) * 0.3, -5 + Math.sin(a) * 3.5);
      const vx = -Math.sin(a) * radiusX;
      const vz = Math.cos(a) * 3.5;
      plane.rotation.set(0, Math.atan2(vx, vz), Math.sin(a) * 0.5);
    });

    board.rotation.y = Math.sin(time * 0.05) * 0.05;
  }

  // Pointer parallax: the camera leans a little toward the cursor.
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  const onPointer = (event: PointerEvent) => {
    pointer.tx = (event.clientX / window.innerWidth - 0.5) * 2;
    pointer.ty = (event.clientY / window.innerHeight - 0.5) * 2;
    hover.active = event.pointerType === "mouse" && floorPoint(event.clientX, event.clientY, hover.point);
  };
  const onLeave = () => {
    hover.active = false;
  };
  const tapPoint = new THREE.Vector3();
  const onTap = (event: PointerEvent) => {
    // Links, buttons and the product miniature keep their own clicks.
    const target = event.target as Element | null;
    if (target?.closest("a, button, input, select, textarea, label, .hero-stage-wrap, .landing-nav")) return;
    if (!floorPoint(event.clientX, event.clientY, tapPoint)) return;
    let best: Student | null = null;
    let bestDistance = 0.75;
    for (const student of students) {
      const distance = Math.hypot(tapPoint.x - student.pos.x, tapPoint.z - student.pos.z);
      if (distance < bestDistance) {
        best = student;
        bestDistance = distance;
      }
    }
    if (best && best.jumpT < 0) best.jumpT = 0;
  };

  function placeCamera(dt: number) {
    pointer.x += (pointer.tx - pointer.x) * (1 - Math.exp(-dt * 2.5));
    pointer.y += (pointer.ty - pointer.y) * (1 - Math.exp(-dt * 2.5));
    camera.position.set(cameraBase.x + pointer.x * 0.7, cameraBase.y - pointer.y * 0.3, cameraBase.z);
    camera.lookAt(lookAt);
  }

  function resize() {
    const width = container.clientWidth || 1;
    const height = container.clientHeight || 1;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    // Narrow screens pull back so the floor still spans the width.
    camera.fov = width < 700 ? 58 : 42;
    camera.updateProjectionMatrix();
  }

  resize();

  if (reduced) {
    // One composed still: stacks standing, students gathered around them. No loop.
    clashTimer = Infinity;
    bellTimer = Infinity;
    blocks.forEach((block, index) => {
      if (index < 10) spawn(block);
      block.t = index < 10 ? 1 : -Infinity;
      block.life = Infinity;
    });
    for (let i = 0; i < 360; i++) step(1 / 30, i / 30);
    placeCamera(1);
    renderer.render(scene, camera);
    options.onReady();
  }

  let frame = 0;
  let running = false;
  let last = 0;
  let elapsed = 0;
  let readySent = reduced;

  const loop = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    elapsed += dt;
    step(dt, elapsed);
    placeCamera(dt);
    renderer.render(scene, camera);
    if (!readySent) {
      readySent = true;
      options.onReady();
    }
    frame = requestAnimationFrame(loop);
  };

  const start = () => {
    if (reduced || running) return;
    running = true;
    last = performance.now();
    frame = requestAnimationFrame(loop);
  };
  const stop = () => {
    running = false;
    cancelAnimationFrame(frame);
  };

  let visible = true;
  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible && !document.hidden) start();
    else stop();
  });
  observer.observe(container);
  const onVisibility = () => (document.hidden || !visible ? stop() : start());
  document.addEventListener("visibilitychange", onVisibility);

  const resizeObserver = new ResizeObserver(() => {
    resize();
    if (reduced) renderer.render(scene, camera);
  });
  resizeObserver.observe(container);
  if (!reduced) {
    window.addEventListener("pointermove", onPointer, { passive: true });
    window.addEventListener("pointerdown", onTap, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
  }

  return () => {
    stop();
    observer.disconnect();
    resizeObserver.disconnect();
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("pointermove", onPointer);
    window.removeEventListener("pointerdown", onTap);
    document.documentElement.removeEventListener("pointerleave", onLeave);
    const disposed = new Set<{ dispose: () => void }>();
    scene.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      disposed.add(mesh.geometry);
      (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((material) => disposed.add(material));
    });
    disposed.forEach((item) => item.dispose());
    renderer.dispose();
    renderer.domElement.remove();
  };
}
