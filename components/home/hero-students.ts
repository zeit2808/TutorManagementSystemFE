import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

/*
 * Chibi students for the hero scene, drawn as instanced parts so a whole class
 * costs a few dozen draw calls. Proportions favour a large head (≈40% of the
 * height) because the figures are seen small and from afar: the face, hair and
 * red scarf are what make them read as children at a glance.
 *
 * Vietnamese school uniform: white short-sleeve shirt, navy trousers or pleated
 * skirt, and for most a red scarf (khăn quàng đỏ). Toon shading keeps the
 * shapes flat and legible against the dark navy backdrop.
 *
 * Hair is a scalp cap plus separate tapered locks (fringe, quiff, face-framing
 * strands, ponytail), so each style has a broken, clumped hairline instead of
 * one straight edge, each lock a shade apart. Eyes are layered
 * decals that follow the curve of the face: a shaded iris, pupil, two
 * catchlights, an upper lash line and a brow, and they can blink.
 */

export interface StudentPose {
  x: number;
  z: number;
  heading: number;
  /** Vertical bounce of the whole body while walking. */
  bob: number;
  /** -1…1 phase of the walk cycle; legs and arms swing in opposition. */
  swing: number;
  /** 0…1 how far the right hand is raised (asking a question in class). */
  raise: number;
  /** Small nod / look-up, radians. */
  tilt: number;
  /** Height of a jump off the floor. */
  lift: number;
  /** 0…1 waving hello with the right hand; `wavePhase` drives the side-to-side motion. */
  wave: number;
  wavePhase: number;
  /** Attendance badge over the head: 0 hidden … 1 full size (may overshoot while popping in). */
  badge: number;
  late: boolean;
  /** 0 eyes open … 1 closed. */
  blink?: number;
}

/** Boys: textured crop, curtain middle part, side part with a quiff, short spikes. */
const BOY_STYLES = ["crop", "curtain", "sidePart", "spiky"] as const;
/** Girls: long with see-through bangs, high ponytail, two braids, bob with blunt bangs, space buns. */
const GIRL_STYLES = ["long", "ponytail", "braids", "bob", "buns"] as const;
type HairStyle = (typeof BOY_STYLES)[number] | (typeof GIRL_STYLES)[number];

interface Look {
  girl: boolean;
  scarf: boolean;
  style: HairStyle;
  /** Which way a side part or swept fringe falls. */
  flip: 1 | -1;
  glasses: boolean;
}

const SKIN = [0xf6d2b4, 0xf1c4a0, 0xe8b48c, 0xf8dcc4];
/** Mostly black and dark brown, with a chestnut and an ash brown for the dyed-hair kids. */
const HAIR = [0x1d1726, 0x2a1d1a, 0x3a2620, 0x14121c, 0x4a2c20, 0x3b302f];
const IRIS = [0x4a2c1a, 0x3a2216, 0x5a3622, 0x2e2838];
const PACK = [0x5b4cf0, 0x2d6cdf, 0x12806a, 0xe0a63a, 0xd9576b, 0x7b6ff5, 0x2bb3c0];
const NAVY_CLOTH = 0x23336b;
/** Sneaker colourways: [upper, accent stripe & heel tab]. Bright uppers so feet read even from afar. */
const SNEAKERS: Array<[number, number]> = [
  [0xe0303f, 0xffffff],
  [0x2d6cdf, 0xf2c14e],
  [0x14b8a6, 0x1b1b28],
  [0xf97316, 0x2d6cdf],
  [0x7b6ff5, 0x34d399],
  [0xf0508a, 0xffffff],
  [0x1b1b28, 0xe0303f],
  [0xf2c14e, 0x5b4cf0],
];
const ON_TIME = 0x16a36f;
const LATE = 0xe0a63a;
const BOW = [0xf0508a, 0xe0303f, 0xff9ec0, 0xffffff, 0xf2c14e];

const HEAD_R = 0.18;
/** Fringe locks and longer strands (quiff, spikes, ponytail) per student. */
const LOCKS = 9;
const STRANDS = 5;
const BRAID_SEGMENTS = 6;

/** Three-step ramp: lit, mid, shadow — the cartoon look. */
function toonRamp() {
  const data = new Uint8Array([90, 90, 90, 255, 175, 175, 175, 255, 255, 255, 255, 255]);
  const texture = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.needsUpdate = true;
  return texture;
}

/** Capsule whose top sits at the origin, so it rotates from the shoulder or hip. */
function limb(radius: number, length: number) {
  const geometry = new THREE.CapsuleGeometry(radius, length, 4, 10);
  geometry.translate(0, -(length / 2 + radius) + radius, 0);
  return geometry;
}

/**
 * A unit lock of hair: rooted at the origin, hanging 1 unit down -y, wide in x,
 * flattened in z by `depth` (z faces out from the scalp) and tapering to a point. `bend`
 * curls it along z as it falls (negative hugs the head, positive flicks out);
 * `wave` adds a soft S so it reads as hair rather than a cone.
 */
function lockGeometry(bend: number, wave: number, depth = 0.5) {
  const geometry = new THREE.CylinderGeometry(1, 0.08, 1, 8, 8);
  geometry.translate(0, -0.5, 0);
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const t = -position.getY(i);
    position.setZ(i, position.getZ(i) * depth + bend * t * t);
    position.setX(i, position.getX(i) + wave * Math.sin(t * Math.PI));
  }
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Hair worn down: an open cylinder around the back of the head whose surface is
 * rippled into clumps and whose hem is scalloped into tips. `curl` turns the
 * ends in, as on a bob. Cylinder θ = 0 faces +z (the face).
 */
function curtainGeometry(rTop: number, rBottom: number, length: number, arcStart: number, arcLength: number, clumps: number, scallop: number, curl: number) {
  const geometry = new THREE.CylinderGeometry(rTop, rBottom, length, 48, 10, true, arcStart, arcLength);
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const t = (length / 2 - y) / length;
    const theta = Math.atan2(x, z);
    const ripple = 0.5 + 0.5 * Math.sin(theta * clumps);
    const r = Math.hypot(x, z) + ripple * 0.012 * t - curl * t ** 3;
    position.setX(i, Math.sin(theta) * r);
    position.setZ(i, Math.cos(theta) * r);
    position.setY(i, y - scallop * ripple * t ** 8);
  }
  geometry.computeVertexNormals();
  return geometry;
}

/** Upper lash line for a right eye (outer corner at +x), in units of the eye's half-width. */
function lashGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(-1.1, -0.05);
  shape.quadraticCurveTo(-0.25, 0.95, 1.05, 0.3);
  shape.lineTo(1.42, 0.52);
  shape.lineTo(1.18, 0.02);
  shape.quadraticCurveTo(-0.15, 0.62, -1.1, -0.05);
  return new THREE.ShapeGeometry(shape, 10);
}

/** Iris disc, darker under the lid and lighter at the bottom; tinted per student by instance colour. */
function irisGeometry() {
  const geometry = new THREE.CircleGeometry(1, 28);
  const position = geometry.attributes.position;
  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    const k = THREE.MathUtils.clamp(0.7 - position.getY(i) * 0.7, 0.3, 1.5);
    colors.set([k, k, k], i * 3);
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geometry;
}

/** A short rounded bar, one unit long, thin in z: brows. */
function browGeometry() {
  const geometry = new THREE.CapsuleGeometry(0.5, 1, 3, 8);
  geometry.rotateZ(Math.PI / 2);
  geometry.scale(0.5, 1, 0.008);
  return geometry;
}

/** [azimuth from the face, elevation, length, width, lift off the scalp, roll, stands up?] */
type LockSpec = [a: number, e: number, len: number, w: number, lift: number, roll: number, up?: boolean];

/** Deterministic per-lock jitter, -1…1, so fringes look messy but never flicker. */
const jitter = (k: number) => (((k * 7919) % 13) / 13 - 0.5) * 2;

const SIDEBURNS: LockSpec[] = [
  [1.32, 0.42, 0.075, 0.04, -0.15, 0],
  [-1.32, 0.42, 0.075, 0.04, -0.15, 0],
];

function fringe(style: HairStyle, flip: number): LockSpec[] {
  const locks: LockSpec[] = [];
  switch (style) {
    case "crop":
      // Textured crop: a short, choppy fringe falling straight down, ends uneven.
      for (let k = 0; k < 7; k++) locks.push([(k - 3) * 0.23, 0.84, 0.1 + (k % 2) * 0.018 + jitter(k) * 0.008, 0.045, -0.12, (k - 3) * -0.05 + jitter(k + 3) * 0.12]);
      locks.push(...SIDEBURNS);
      break;
    case "curtain":
      // Curtain fringe: parted in the middle, each half sweeping out to the temples.
      for (const side of [-1, 1]) for (let j = 0; j < 4; j++) locks.push([side * (0.13 + j * 0.27), 0.9, 0.14 - j * 0.012, 0.05, -0.1, side * (0.62 + j * 0.14)]);
      break;
    case "sidePart":
      // Side part: long locks swept across the forehead; the rest is lifted into the quiff (strands).
      locks.push([flip * 0.45, 0.92, 0.17, 0.06, -0.08, -flip * 1.05], [flip * 0.1, 0.95, 0.15, 0.05, -0.08, -flip * 1.1], ...SIDEBURNS);
      break;
    case "spiky":
      for (let k = 0; k < 3; k++) locks.push([(k - 1) * 0.35, 0.84, 0.07, 0.045, -0.12, (k - 1) * -0.2]);
      locks.push(...SIDEBURNS);
      break;
    case "long":
      // See-through bangs: thin, separated locks, plus two long strands framing the face.
      for (let k = 0; k < 6; k++) locks.push([(k - 2.5) * 0.2, 0.84, 0.12 + jitter(k) * 0.01, 0.034, -0.12, (k - 2.5) * -0.06]);
      locks.push([0.82, 0.5, 0.3, 0.056, -0.06, 0.08], [-0.82, 0.5, 0.3, 0.056, -0.06, -0.08]);
      break;
    case "ponytail":
      for (let k = 0; k < 5; k++) locks.push([(k - 2) * 0.24 + flip * 0.08, 0.84, 0.115, 0.045, -0.12, flip * 0.35]);
      locks.push([0.88, 0.5, 0.17, 0.034, -0.05, 0.05], [-0.88, 0.5, 0.17, 0.034, -0.05, -0.05]);
      break;
    case "braids":
    case "bob":
      // Blunt bangs: dense, even, cut just above the brows.
      for (let k = 0; k < 7; k++) locks.push([(k - 3) * 0.2, 0.82, style === "bob" ? 0.122 : 0.114, 0.05, -0.12, (k - 3) * -0.03]);
      break;
    case "buns":
      for (let k = 0; k < 5; k++) locks.push([(k - 2) * 0.24, 0.84, 0.11 + jitter(k) * 0.01, 0.034, -0.12, (k - 2) * -0.06]);
      locks.push([0.88, 0.5, 0.2, 0.034, -0.05, 0.05], [-0.88, 0.5, 0.2, 0.034, -0.05, -0.05]);
      break;
  }
  return locks;
}

function strands(style: HairStyle, flip: number): LockSpec[] {
  switch (style) {
    case "sidePart":
      // Quiff: locks rising from the hairline and swept over to the side.
      return [-0.5, -0.17, 0.17, 0.5].map((a, k): LockSpec => [a, 0.9, 0.11 - Math.abs(a) * 0.04, 0.058, 0.3, flip * (0.55 + k * 0.06), true]);
    case "spiky":
      // Short spikes fanned across the front of the crown, tips flicked back.
      return [-0.8, -0.4, 0, 0.4, 0.8].map((a, k): LockSpec => [a, 0.95 + (k % 2) * 0.2, 0.085 + (k % 2) * 0.02, 0.05, 0.45, a * 0.9, true]);
    case "ponytail":
      // High ponytail from the back of the crown; a thinner second lock gives it volume.
      return [
        [Math.PI, 0.6, 0.36, 0.072, 0.08, 0],
        [Math.PI, 0.58, 0.28, 0.05, 0.18, 0.2],
      ];
    default:
      return [];
  }
}

export function createStudents(parent: THREE.Object3D, count: number) {
  const ramp = toonRamp();
  const toon = (color: number, emissive = 0x000000) => new THREE.MeshToonMaterial({ color, gradientMap: ramp, emissive });
  const decal = (options: THREE.MeshBasicMaterialParameters = {}) => new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, ...options });

  // Shirt and skin carry a faint self-glow so the figures stay bright on the navy floor.
  const materials = {
    shirt: toon(0xffffff, 0x1c1c3a),
    skin: toon(0xffffff, 0x2a1810),
    cloth: toon(0xffffff),
    hair: new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: ramp, side: THREE.DoubleSide, emissive: 0x0c0a14 }),
    sole: toon(0xffffff, 0x24243e),
    upper: toon(0xffffff, 0x14142a),
    laces: toon(0xffffff, 0x24243e),
    sock: toon(0xffffff, 0x1c1c3a),
    belt: toon(0x1b1b28),
    bow: toon(0xffffff, 0x2a0a18),
    scarf: toon(0xe0303f, 0x3a0608),
    pack: toon(0xffffff),
    // Face decals are unlit so the eyes stay crisp whichever way the head turns.
    iris: decal({ vertexColors: true }),
    pupil: decal({ color: 0x0e0a12 }),
    shine: decal(),
    lash: decal({ color: 0x17111c }),
    brow: decal(),
    mouth: decal({ color: 0x7a3035 }),
    blush: decal({ color: 0xff8a9e, transparent: true, opacity: 0.4, depthWrite: false }),
    glasses: new THREE.MeshBasicMaterial({ color: 0x2a2840 }),
    // Badges are unlit stickers so their colour reads the same from every angle.
    badge: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    badgeMark: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    shadow: new THREE.MeshBasicMaterial({ color: 0x07061f, transparent: true, opacity: 0.38, depthWrite: false }),
  };

  // Scalp cap down to the hairline; the locks hide its edge. Sphere φ runs from -x through +z, so φ = 3π/2 is the back.
  const hairCap = new THREE.SphereGeometry(0.19, 28, 12, 0, Math.PI * 2, 0, Math.PI * 0.38);
  // Back of the head: to the nape for girls; cropped short for boys so ears and neck show.
  const hairBack = new THREE.SphereGeometry(0.191, 24, 8, Math.PI * 0.9, Math.PI * 1.2, Math.PI * 0.3, Math.PI * 0.42);
  const hairNape = new THREE.SphereGeometry(0.191, 24, 6, Math.PI * 1.0, Math.PI, Math.PI * 0.3, Math.PI * 0.26);
  // Long hair worn loose, clumped with a scalloped hem; and a chin-length bob whose ends curl in.
  const longHair = curtainGeometry(0.192, 0.24, 0.46, Math.PI * 0.36, Math.PI * 1.28, 13, 0.05, 0);
  const bob = curtainGeometry(0.188, 0.215, 0.24, Math.PI * 0.27, Math.PI * 1.46, 15, 0.02, 0.035);
  const shadowGeo = new THREE.CircleGeometry(0.26, 20);
  shadowGeo.rotateX(-Math.PI / 2);
  const skirt = new THREE.CylinderGeometry(0.13, 0.215, 0.16, 12);
  const scarfKnot = new THREE.SphereGeometry(0.04, 10, 8);
  const scarfTail = new THREE.ConeGeometry(0.05, 0.13, 3);
  scarfTail.rotateX(Math.PI);
  const lens = new THREE.TorusGeometry(0.042, 0.009, 6, 16);
  // Smile: a short arc opening upwards.
  const smile = new THREE.TorusGeometry(0.02, 0.0045, 4, 12, Math.PI * 0.62);
  smile.rotateZ(-Math.PI / 2 - Math.PI * 0.31);

  // Attendance badge: a coin-like disc with a white rim, carrying a check (on time) or a clock face (late).
  const badgeDisc = new THREE.CylinderGeometry(0.11, 0.11, 0.02, 28);
  badgeDisc.rotateX(Math.PI / 2);
  const badgeRim = new THREE.TorusGeometry(0.11, 0.014, 6, 28);
  const stroke = new RoundedBoxGeometry(1, 0.032, 0.012, 1, 0.006);

  const make = (geometry: THREE.BufferGeometry, material: THREE.Material, perStudent = 1) => {
    const mesh = new THREE.InstancedMesh(geometry, material, count * perStudent);
    mesh.frustumCulled = false;
    parent.add(mesh);
    return mesh;
  };

  const parts = {
    shadow: make(shadowGeo, materials.shadow),
    torso: make(new RoundedBoxGeometry(0.3, 0.27, 0.2, 3, 0.08), materials.shirt),
    collar: make(new THREE.CylinderGeometry(0.075, 0.09, 0.05, 12), materials.shirt),
    hips: make(new RoundedBoxGeometry(0.28, 0.1, 0.19, 2, 0.04), materials.cloth),
    skirt: make(skirt, materials.cloth),
    legs: make(limb(0.055, 0.17), materials.cloth, 2),
    // Chunky cartoon sneakers: thick white sole, coloured upper, white toe cap and laces, contrast stripe and heel tab.
    soles: make(new RoundedBoxGeometry(0.13, 0.04, 0.205, 2, 0.017), materials.sole, 2),
    uppers: make(new RoundedBoxGeometry(0.115, 0.065, 0.16, 3, 0.03), materials.upper, 2),
    toes: make(new THREE.SphereGeometry(0.058, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), materials.sole, 2),
    tongues: make(new RoundedBoxGeometry(0.06, 0.022, 0.085, 2, 0.01), materials.laces, 2),
    stripes: make(new RoundedBoxGeometry(0.121, 0.018, 0.1, 2, 0.008), materials.upper, 2),
    heels: make(new RoundedBoxGeometry(0.06, 0.05, 0.03, 2, 0.012), materials.upper, 2),
    arms: make(limb(0.045, 0.16), materials.skin, 2),
    sleeves: make(new THREE.CylinderGeometry(0.062, 0.068, 0.1, 10), materials.shirt, 2),
    hands: make(new THREE.SphereGeometry(0.05, 10, 8), materials.skin, 2),
    neck: make(new THREE.CylinderGeometry(0.05, 0.05, 0.06, 8), materials.skin),
    head: make(new THREE.SphereGeometry(HEAD_R, 24, 18), materials.skin),
    ears: make(new THREE.SphereGeometry(0.04, 8, 6), materials.skin, 2),
    hairCap: make(hairCap, materials.hair),
    hairBack: make(hairBack, materials.hair),
    hairNape: make(hairNape, materials.hair),
    longHair: make(longHair, materials.hair),
    bob: make(bob, materials.hair),
    locks: make(lockGeometry(-0.55, 0.06), materials.hair, LOCKS),
    strands: make(lockGeometry(1.1, 0.1), materials.hair, STRANDS),
    // Ponytail: round in section, drooping as it falls.
    ponytail: make(lockGeometry(-0.7, 0.05, 0.9), materials.hair, 2),
    buns: make(new THREE.SphereGeometry(0.068, 14, 10), materials.hair, 2),
    braids: make(new THREE.SphereGeometry(0.042, 10, 8), materials.hair, 2 * BRAID_SEGMENTS),
    braidTies: make(new THREE.SphereGeometry(0.035, 8, 6), materials.bow, 2),
    scrunchie: make(new THREE.TorusGeometry(0.045, 0.02, 6, 14), materials.bow),
    bowLoops: make(new THREE.SphereGeometry(0.05, 10, 8), materials.bow, 2),
    bowKnot: make(new THREE.SphereGeometry(0.025, 8, 6), materials.bow),
    socks: make(new THREE.CylinderGeometry(0.059, 0.059, 0.07, 10), materials.sock, 2),
    belt: make(new RoundedBoxGeometry(0.3, 0.035, 0.205, 2, 0.015), materials.belt),
    irises: make(irisGeometry(), materials.iris, 2),
    pupils: make(new THREE.CircleGeometry(1, 20), materials.pupil, 2),
    // Two catchlights per eye: a big one up toward the key light, a small one below.
    shines: make(new THREE.CircleGeometry(1, 14), materials.shine, 4),
    lashes: make(lashGeometry(), materials.lash, 2),
    brows: make(browGeometry(), materials.brow, 2),
    mouth: make(smile, materials.mouth),
    blush: make(new THREE.CircleGeometry(1, 16), materials.blush, 2),
    glasses: make(lens, materials.glasses, 2),
    scarfKnot: make(scarfKnot, materials.scarf),
    scarfTails: make(scarfTail, materials.scarf, 2),
    pack: make(new RoundedBoxGeometry(0.26, 0.28, 0.12, 3, 0.05), materials.pack),
    badgeDiscs: make(badgeDisc, materials.badge),
    badgeRims: make(badgeRim, materials.badgeMark),
    // Two strokes per student: the check's short + long arms, or the clock's hour + minute hands.
    badgeStrokes: make(stroke, materials.badgeMark, 2),
    packFlap: make(new RoundedBoxGeometry(0.24, 0.1, 0.13, 2, 0.04), materials.pack),
  };

  // Per-student identity. Styles are dealt in turn from a random start, so every class shows the full range.
  const color = new THREE.Color();
  const boyOffset = Math.floor(Math.random() * BOY_STYLES.length);
  const girlOffset = Math.floor(Math.random() * GIRL_STYLES.length);
  const fringes: LockSpec[][] = [];
  const strandSpecs: LockSpec[][] = [];
  const looks: Look[] = Array.from({ length: count }, (_, index) => {
    const girl = index % 2 === 1;
    const turn = Math.floor(index / 2);
    const look: Look = {
      girl,
      scarf: Math.random() < 0.75,
      style: girl ? GIRL_STYLES[(turn + girlOffset) % GIRL_STYLES.length] : BOY_STYLES[(turn + boyOffset) % BOY_STYLES.length],
      flip: Math.random() < 0.5 ? 1 : -1,
      glasses: Math.random() < 0.18,
    };
    fringes.push(fringe(look.style, look.flip));
    strandSpecs.push(strands(look.style, look.flip));
    const skin = SKIN[Math.floor(Math.random() * SKIN.length)];
    const hair = HAIR[Math.floor(Math.random() * HAIR.length)];
    const iris = IRIS[Math.floor(Math.random() * IRIS.length)];
    const pack = PACK[Math.floor(Math.random() * PACK.length)];
    for (const part of [parts.head, parts.neck] as THREE.InstancedMesh[]) part.setColorAt(index, color.setHex(skin));
    for (const part of [parts.hairCap, parts.hairBack, parts.hairNape, parts.longHair, parts.bob]) part.setColorAt(index, color.setHex(hair));
    // Locks vary a shade from one another so the clumps separate.
    for (let k = 0; k < LOCKS; k++) parts.locks.setColorAt(index * LOCKS + k, color.setHex(hair).multiplyScalar(1 + jitter(k + index) * 0.1));
    for (let k = 0; k < STRANDS; k++) parts.strands.setColorAt(index * STRANDS + k, color.setHex(hair).multiplyScalar(1 + jitter(k * 3 + index) * 0.1));
    for (let k = 0; k < 2; k++) parts.ponytail.setColorAt(index * 2 + k, color.setHex(hair).multiplyScalar(1 - k * 0.08));
    for (let k = 0; k < 2 * BRAID_SEGMENTS; k++) parts.braids.setColorAt(index * 2 * BRAID_SEGMENTS + k, color.setHex(hair));
    for (let k = 0; k < 4; k++) parts.shines.setColorAt(index * 4 + k, color.setHex(0xffffff));
    const bow = BOW[Math.floor(Math.random() * BOW.length)];
    const [upper, accent] = SNEAKERS[Math.floor(Math.random() * SNEAKERS.length)];
    parts.bowKnot.setColorAt(index, color.setHex(bow));
    parts.scrunchie.setColorAt(index, color.setHex(bow));
    // Seed the badge colour so the material compiles with per-instance colour from the first frame.
    parts.badgeDiscs.setColorAt(index, color.setHex(ON_TIME));
    parts.hips.setColorAt(index, color.setHex(NAVY_CLOTH));
    parts.skirt.setColorAt(index, color.setHex(NAVY_CLOTH));
    parts.pack.setColorAt(index, color.setHex(pack));
    parts.packFlap.setColorAt(index, color.setHex(pack).multiplyScalar(0.82));
    for (let side = 0; side < 2; side++) {
      const slot = index * 2 + side;
      parts.arms.setColorAt(slot, color.setHex(skin));
      parts.hands.setColorAt(slot, color.setHex(skin));
      parts.ears.setColorAt(slot, color.setHex(skin));
      parts.uppers.setColorAt(slot, color.setHex(upper));
      parts.stripes.setColorAt(slot, color.setHex(accent));
      parts.heels.setColorAt(slot, color.setHex(accent));
      parts.buns.setColorAt(slot, color.setHex(hair));
      parts.braidTies.setColorAt(slot, color.setHex(bow));
      parts.bowLoops.setColorAt(slot, color.setHex(bow));
      parts.irises.setColorAt(slot, color.setHex(iris));
      parts.brows.setColorAt(slot, color.setHex(hair).multiplyScalar(0.85));
      // Boys: navy trousers to the ankle. Girls: bare legs under the skirt.
      parts.legs.setColorAt(slot, color.setHex(girl ? skin : NAVY_CLOTH));
    }
    return look;
  });

  /* Matrix helpers: everything is composed from a few reusable scratch objects. */
  const root = new THREE.Matrix4();
  const torso = new THREE.Matrix4();
  const head = new THREE.Matrix4();
  const joint = new THREE.Matrix4();
  const shoe = new THREE.Matrix4();
  const yaw = new THREE.Matrix4();
  const out = new THREE.Matrix4();
  const local = new THREE.Matrix4();
  const euler = new THREE.Euler();
  const quat = new THREE.Quaternion();
  const roll = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const FORWARD = new THREE.Vector3(0, 0, 1);
  const hidden = new THREE.Matrix4().makeScale(0, 0, 0);

  /** out = parentMatrix · T(x,y,z) · R(rx,ry,rz) · S(s) */
  const at = (target: THREE.Matrix4, parentMatrix: THREE.Matrix4, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, s: number | THREE.Vector3 = 1) => {
    quat.setFromEuler(euler.set(rx, ry, rz));
    if (typeof s === "number") scale.setScalar(s);
    else scale.copy(s);
    local.compose(pos.set(x, y, z), quat, scale);
    return target.multiplyMatrices(parentMatrix, local);
  };
  const put = (mesh: THREE.InstancedMesh, slot: number, matrix: THREE.Matrix4, visible = true) => mesh.setMatrixAt(slot, visible ? matrix : hidden);

  /** A flat decal lying on the face at (x, y), `depth` above the skin, turned `rz` in its own plane. */
  const onFace = (x: number, y: number, depth: number, sx: number, sy: number, rz = 0) => {
    const r = HEAD_R + depth;
    const z = Math.sqrt(Math.max(0, r * r - x * x - y * y));
    quat.setFromUnitVectors(FORWARD, normal.set(x, y, z).normalize());
    if (rz) quat.multiply(roll.setFromAxisAngle(FORWARD, rz));
    local.compose(pos.set(x, y, z), quat, scale.set(sx, sy, 1));
    return out.multiplyMatrices(head, local);
  };

  /** A lock rooted on the scalp at azimuth `a` (0 = the face) and elevation `e`, hanging down the head or standing up. */
  const lockAt = ([a, e, len, w, lift, rz, up]: LockSpec, sway: number) => {
    at(yaw, head, 0, 0, 0, 0, a, 0);
    const r = 0.186;
    const rx = up ? Math.PI + lift : -(e + lift) + sway;
    return at(out, yaw, 0, r * Math.sin(e), r * Math.cos(e), rx, 0, rz, scale.set(w, len, w));
  };

  /** Rotation that turns a badge to face the camera, in the parent's space. Set once per frame. */
  const facing = new THREE.Quaternion();
  function face(quaternion: THREE.Quaternion) {
    facing.copy(quaternion);
  }
  const badgeRoot = new THREE.Matrix4();
  const badgeColor = new THREE.Color();

  function update(index: number, pose: StudentPose) {
    const look = looks[index];
    const { swing, raise } = pose;

    quat.setFromEuler(euler.set(0, pose.heading, 0));
    root.compose(pos.set(pose.x, 0, pose.z), quat, scale.setScalar(1));

    // Contact shadow stays on the floor and tightens with the step, and more while airborne.
    at(out, root, 0, 0.004, 0, 0, 0, 0, Math.max(0.35, 1 - pose.bob * 2.5 - pose.lift * 1.2));
    put(parts.shadow, index, out);
    if (pose.lift > 0) root.multiply(local.makeTranslation(0, pose.lift, 0));

    // Body sways slightly side to side with the stride.
    at(torso, root, 0, pose.bob, 0, 0, swing * 0.08, swing * 0.035);

    // Legs pivot at the hips; sneakers ride on the legs and flex a little against the swing.
    for (let side = 0; side < 2; side++) {
      const sign = side === 0 ? -1 : 1;
      const legSwing = swing * 0.62 * sign;
      at(joint, torso, sign * 0.075, 0.25, 0, legSwing);
      put(parts.legs, index * 2 + side, joint);
      const slot = index * 2 + side;
      at(shoe, joint, 0, -0.215, 0.028, -legSwing * 0.4);
      put(parts.soles, slot, at(out, shoe, 0, -0.016, 0.004));
      put(parts.uppers, slot, at(out, shoe, 0, 0.018, -0.01));
      put(parts.toes, slot, at(out, shoe, 0, -0.002, 0.05, 0, 0, 0, scale.set(1, 0.62, 0.95)));
      put(parts.tongues, slot, at(out, shoe, 0, 0.05, 0.025, 0.32));
      put(parts.stripes, slot, at(out, shoe, 0, 0.012, -0.018, 0, 0, 0));
      put(parts.heels, slot, at(out, shoe, 0, 0.04, -0.085, -0.2));
      put(parts.socks, slot, at(out, joint, 0, -0.16, 0), look.girl);
    }

    at(out, torso, 0, 0.29, 0);
    put(parts.hips, index, out);
    at(out, torso, 0, 0.27, 0);
    put(parts.skirt, index, out, look.girl);
    // Boys a touch broader in the shoulders, girls slimmer.
    at(out, torso, 0, 0.44, 0, 0, 0, 0, scale.set(look.girl ? 0.9 : 1.07, 1, look.girl ? 0.95 : 1));
    put(parts.torso, index, out);
    at(out, torso, 0, 0.335, 0);
    put(parts.belt, index, out, !look.girl);
    at(out, torso, 0, 0.585, 0);
    put(parts.collar, index, out);

    // Arms pivot at the shoulders, swinging against the legs; the right one can go up to ask a question.
    for (let side = 0; side < 2; side++) {
      const sign = side === 0 ? -1 : 1;
      const isRight = side === 1;
      const armSwing = -swing * 0.55 * sign;
      const up = isRight ? Math.max(raise, pose.wave) : 0;
      const rx = THREE.MathUtils.lerp(armSwing, -2.85, up);
      // Waving rocks the raised arm side to side from the shoulder.
      const rz = sign * THREE.MathUtils.lerp(0.14, 0.05, up) + (isRight ? pose.wave * Math.sin(pose.wavePhase) * 0.5 : 0);
      at(joint, torso, sign * (look.girl ? 0.162 : 0.185), 0.55, 0, rx, 0, rz);
      put(parts.sleeves, index * 2 + side, at(out, joint, 0, -0.03, 0));
      put(parts.arms, index * 2 + side, joint);
      put(parts.hands, index * 2 + side, at(out, joint, 0, -0.23, 0));
    }

    // Scarf: knot at the collar, two tails hanging over the chest.
    at(out, torso, 0, 0.555, 0.105);
    put(parts.scarfKnot, index, out, look.scarf);
    for (let side = 0; side < 2; side++) {
      const sign = side === 0 ? -1 : 1;
      at(out, torso, sign * 0.03, 0.49, 0.112, 0.12, 0, sign * 0.28, 1);
      put(parts.scarfTails, index * 2 + side, out, look.scarf);
    }

    // Backpack on the back.
    at(out, torso, 0, 0.45, -0.155);
    put(parts.pack, index, out);
    at(out, torso, 0, 0.55, -0.16);
    put(parts.packFlap, index, out);

    at(out, torso, 0, 0.625, 0);
    put(parts.neck, index, out);

    // Head: big and round, with a gentle nod; everything on the face hangs off it.
    at(head, torso, 0, 0.8, 0, pose.tilt, swing * -0.06, 0);
    put(parts.head, index, head);

    // Face. Eyes are decals that follow the curve of the head; a blink squashes them under the lash line.
    const open = 1 - THREE.MathUtils.clamp(pose.blink ?? 0, 0, 1);
    const ey = -0.004;
    for (let side = 0; side < 2; side++) {
      const sign = side === 0 ? -1 : 1;
      const slot = index * 2 + side;
      const ex = sign * 0.062;
      put(parts.ears, slot, at(out, head, sign * 0.175, -0.01, 0, 0, 0, 0, scale.set(0.6, 1, 0.8)));
      put(parts.irises, slot, onFace(ex, ey - 0.006 * (1 - open), 0.0012, 0.026, 0.034 * Math.max(0.08, open)));
      put(parts.pupils, slot, onFace(ex, ey + 0.002, 0.0022, 0.0135, 0.019 * open), open > 0.4);
      put(parts.shines, index * 4 + side * 2, onFace(ex - 0.009, ey + 0.013, 0.0032, 0.0085, 0.0095 * open), open > 0.4);
      put(parts.shines, index * 4 + side * 2 + 1, onFace(ex + 0.01, ey - 0.014, 0.0032, 0.0045, 0.0045 * open), open > 0.4);
      // Lash line hugs the top of the iris, with a flick at the outer corner (bolder for girls); closed, it becomes the lid.
      const lashSize = look.girl ? 0.03 : 0.028;
      put(parts.lashes, slot, onFace(ex, ey + 0.017 * open - 0.008 * (1 - open), 0.0028, sign * lashSize, lashSize * (look.girl ? 1.05 : 0.8) * (0.55 + 0.45 * open)));
      put(parts.brows, slot, onFace(sign * 0.066, 0.05, 0.002, 0.048, look.girl ? 0.009 : 0.013, sign * -0.12));
      put(parts.blush, slot, onFace(sign * 0.105, -0.045, 0.0015, 0.024, 0.015));
      put(parts.glasses, slot, at(out, head, ex, ey, 0.176), look.glasses);

      // Braids fall forward over the shoulders as a plait of alternating segments.
      at(joint, head, sign * 0.14, -0.1, -0.02, -0.3 + swing * sign * 0.12, 0, sign * 0.24);
      for (let k = 0; k < BRAID_SEGMENTS; k++) {
        const taper = 1 - k * 0.07;
        const zig = k % 2 ? 1 : -1;
        at(out, joint, zig * 0.008, -0.03 - k * 0.05, 0, 0, 0, zig * 0.45, scale.set(taper, 1.35 * taper, taper));
        put(parts.braids, slot * BRAID_SEGMENTS + k, out, look.style === "braids");
      }
      put(parts.braidTies, slot, at(out, joint, 0, -0.33, 0), look.style === "braids");
      // Space buns on top of the head.
      put(parts.buns, slot, at(out, head, sign * 0.115, 0.15, -0.02, 0, 0, 0, scale.set(1, 0.95, 1)), look.style === "buns");
    }
    put(parts.mouth, index, onFace(0, -0.072, 0.003, 1, 1));

    // Hair bow on the side of the crown, for the styles that leave room for one.
    const bowed = look.girl && look.style !== "buns" && look.style !== "ponytail";
    for (let side = 0; side < 2; side++) {
      const sign = side === 0 ? -1 : 1;
      put(parts.bowLoops, index * 2 + side, at(out, head, 0.1 + sign * 0.055, 0.16, 0.04, 0, 0, -0.55 + sign * 0.5, scale.set(1.25, 0.75, 0.5)), bowed);
    }
    put(parts.bowKnot, index, at(out, head, 0.1, 0.16, 0.045), bowed);

    // Hair. A quiff or curtain part gets a little extra height on the crown.
    const tall = look.style === "sidePart" || look.style === "curtain" ? 1.06 : look.style === "spiky" ? 1.0 : 1.03;
    at(out, head, 0, 0.008, -0.004, 0, 0, 0, scale.set(1.02, tall, 1.02));
    put(parts.hairCap, index, out);
    put(parts.hairBack, index, head, look.girl && look.style !== "bob");
    put(parts.hairNape, index, head, !look.girl);
    // Loose long hair sways a little behind the walk; the bob sits close around the jaw.
    put(parts.longHair, index, at(out, head, 0, -0.25, -0.01, Math.abs(swing) * 0.08), look.style === "long");
    put(parts.bob, index, at(out, head, 0, -0.072, -0.004, Math.abs(swing) * 0.04), look.style === "bob");

    const sway = Math.abs(swing) * 0.1;
    const lockList = fringes[index];
    for (let k = 0; k < LOCKS; k++) {
      const spec = lockList[k];
      // Only the long face-framing strands sway; the fringe stays put.
      put(parts.locks, index * LOCKS + k, spec ? lockAt(spec, spec[2] > 0.2 ? sway : 0) : hidden);
    }
    const strandList = strandSpecs[index];
    const tail = look.style === "ponytail";
    for (let k = 0; k < STRANDS; k++) {
      const spec = tail ? undefined : strandList[k];
      put(parts.strands, index * STRANDS + k, spec ? lockAt(spec, 0) : hidden);
    }
    for (let k = 0; k < 2; k++) {
      const spec = tail ? strandList[k] : undefined;
      // The ponytail swings side to side with the stride.
      put(parts.ponytail, index * 2 + k, spec ? lockAt([spec[0], spec[1], spec[2], spec[3], spec[4], spec[5] + swing * 0.25], 0) : hidden);
    }
    at(yaw, head, 0, 0, 0, 0, Math.PI, 0);
    put(parts.scrunchie, index, at(out, yaw, 0, 0.186 * Math.sin(0.6), 0.186 * Math.cos(0.6), 0.68), look.style === "ponytail");

    // Attendance badge floats above the head and always faces the camera.
    const shown = pose.badge > 0.001;
    if (shown) {
      pos.set(pose.x, pose.lift + pose.bob + 1.3 + (1 - Math.min(1, pose.badge)) * -0.12, pose.z);
      badgeRoot.compose(pos, facing, scale.setScalar(pose.badge));
      parts.badgeDiscs.setColorAt(index, badgeColor.setHex(pose.late ? LATE : ON_TIME));
    }
    put(parts.badgeDiscs, index, badgeRoot, shown);
    put(parts.badgeRims, index, badgeRoot, shown);
    if (pose.late) {
      // Clock: hour hand to 12, minute hand to 3 — "late" at a glance.
      put(parts.badgeStrokes, index * 2, at(out, badgeRoot, 0, 0.025, 0.014, 0, 0, Math.PI / 2, scale.set(0.06, 1, 1)), shown);
      put(parts.badgeStrokes, index * 2 + 1, at(out, badgeRoot, 0.03, 0, 0.014, 0, 0, 0, scale.set(0.07, 1, 1)), shown);
    } else {
      // Check mark: short arm down-left, long arm up-right.
      put(parts.badgeStrokes, index * 2, at(out, badgeRoot, -0.028, -0.006, 0.014, 0, 0, -0.8, scale.set(0.065, 1, 1)), shown);
      put(parts.badgeStrokes, index * 2 + 1, at(out, badgeRoot, 0.016, 0.012, 0.014, 0, 0, 0.9, scale.set(0.11, 1, 1)), shown);
    }
  }

  function commit() {
    for (const mesh of Object.values(parts)) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }

  return { update, commit, face };
}
