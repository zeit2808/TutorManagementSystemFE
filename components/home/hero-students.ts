import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

/*
 * Chibi students for the hero scene, drawn as instanced parts so a whole class
 * costs about twenty draw calls. Proportions favour a large head (≈40% of the
 * height) because the figures are seen small and from afar: the face, hair and
 * red scarf are what make them read as children at a glance.
 *
 * Vietnamese school uniform: white short-sleeve shirt, navy trousers or pleated
 * skirt, and for most a red scarf (khăn quàng đỏ). Toon shading keeps the
 * shapes flat and legible against the dark navy backdrop.
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
}

interface Look {
  girl: boolean;
  scarf: boolean;
  /** Girls only: two long braids over the shoulders instead of hair worn loose down the back. */
  braids: boolean;
  glasses: boolean;
}

const SKIN = [0xf6d2b4, 0xf1c4a0, 0xe8b48c, 0xf8dcc4];
const HAIR = [0x1d1726, 0x2a1d1a, 0x3a2620, 0x14121c];
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

export function createStudents(parent: THREE.Object3D, count: number) {
  const ramp = toonRamp();
  const toon = (color: number, emissive = 0x000000) => new THREE.MeshToonMaterial({ color, gradientMap: ramp, emissive });

  // Shirt and skin carry a faint self-glow so the figures stay bright on the navy floor.
  const materials = {
    shirt: toon(0xffffff, 0x1c1c3a),
    skin: toon(0xffffff, 0x2a1810),
    cloth: toon(0xffffff),
    hair: new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: ramp, side: THREE.DoubleSide }),
    sole: toon(0xffffff, 0x24243e),
    upper: toon(0xffffff, 0x14142a),
    laces: toon(0xffffff, 0x24243e),
    sock: toon(0xffffff, 0x1c1c3a),
    belt: toon(0x1b1b28),
    bow: toon(0xffffff, 0x2a0a18),
    scarf: toon(0xe0303f, 0x3a0608),
    pack: toon(0xffffff),
    eye: new THREE.MeshBasicMaterial({ color: 0x15131f }),
    shine: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    glasses: new THREE.MeshBasicMaterial({ color: 0x2a2840 }),
    // Badges are unlit stickers so their colour reads the same from every angle.
    badge: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    badgeMark: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    shadow: new THREE.MeshBasicMaterial({ color: 0x07061f, transparent: true, opacity: 0.38, depthWrite: false }),
  };

  // Hair: a crown cap down to the brow (it doubles as the fringe) plus a back piece, leaving the face open.
  // Sphere φ runs from -x through +z, so φ = 3π/2 is the back of the head.
  const hairCap = new THREE.SphereGeometry(0.19, 22, 10, 0, Math.PI * 2, 0, Math.PI * 0.42);
  // Girls: the back piece reaches the nape. Boys: cropped short so ears and neck show.
  const hairBack = new THREE.SphereGeometry(0.191, 22, 8, Math.PI * 0.9, Math.PI * 1.2, Math.PI * 0.3, Math.PI * 0.42);
  const hairNape = new THREE.SphereGeometry(0.191, 22, 6, Math.PI * 1.0, Math.PI, Math.PI * 0.3, Math.PI * 0.26);
  // Long hair worn loose: a tapered curtain around the back and sides, falling past the shoulders.
  // Cylinder θ = 0 faces +z (the face), so the opening sits at the front.
  const longHair = new THREE.CylinderGeometry(0.192, 0.235, 0.46, 24, 3, true, Math.PI * 0.36, Math.PI * 1.28);
  // Boys: a short spiky tuft standing up at the front of the crown.
  const spike = new THREE.ConeGeometry(0.055, 0.1, 6);
  const shadowGeo = new THREE.CircleGeometry(0.26, 20);
  shadowGeo.rotateX(-Math.PI / 2);
  const skirt = new THREE.CylinderGeometry(0.13, 0.215, 0.16, 12);
  const scarfKnot = new THREE.SphereGeometry(0.04, 10, 8);
  const scarfTail = new THREE.ConeGeometry(0.05, 0.13, 3);
  scarfTail.rotateX(Math.PI);
  const lens = new THREE.TorusGeometry(0.042, 0.009, 6, 16);

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
    head: make(new THREE.SphereGeometry(0.18, 22, 16), materials.skin),
    ears: make(new THREE.SphereGeometry(0.04, 8, 6), materials.skin, 2),
    hairCap: make(hairCap, materials.hair),
    hairBack: make(hairBack, materials.hair),
    hairNape: make(hairNape, materials.hair),
    spikes: make(spike, materials.hair, 3),
    longHair: make(longHair, materials.hair),
    sideLocks: make(new RoundedBoxGeometry(0.07, 0.34, 0.09, 2, 0.03), materials.hair, 2),
    braids: make(limb(0.048, 0.3), materials.hair, 2),
    braidTies: make(new THREE.SphereGeometry(0.035, 8, 6), materials.bow, 2),
    bowLoops: make(new THREE.SphereGeometry(0.05, 10, 8), materials.bow, 2),
    bowKnot: make(new THREE.SphereGeometry(0.025, 8, 6), materials.bow),
    socks: make(new THREE.CylinderGeometry(0.059, 0.059, 0.07, 10), materials.sock, 2),
    belt: make(new RoundedBoxGeometry(0.3, 0.035, 0.205, 2, 0.015), materials.belt),
    eyes: make(new THREE.SphereGeometry(0.026, 10, 8), materials.eye, 2),
    shines: make(new THREE.SphereGeometry(0.009, 6, 4), materials.shine, 2),
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

  // Per-student identity.
  const color = new THREE.Color();
  const looks: Look[] = Array.from({ length: count }, (_, index) => {
    const girl = index % 2 === 1;
    const look: Look = {
      girl,
      scarf: Math.random() < 0.75,
      braids: girl && Math.random() < 0.35,
      glasses: Math.random() < 0.18,
    };
    const skin = SKIN[Math.floor(Math.random() * SKIN.length)];
    const hair = HAIR[Math.floor(Math.random() * HAIR.length)];
    const pack = PACK[Math.floor(Math.random() * PACK.length)];
    for (const part of [parts.head, parts.neck] as THREE.InstancedMesh[]) part.setColorAt(index, color.setHex(skin));
    for (const part of [parts.hairCap, parts.hairBack, parts.hairNape, parts.longHair]) part.setColorAt(index, color.setHex(hair));
    const bow = BOW[Math.floor(Math.random() * BOW.length)];
    const [upper, accent] = SNEAKERS[Math.floor(Math.random() * SNEAKERS.length)];
    parts.bowKnot.setColorAt(index, color.setHex(bow));
    for (let tuft = 0; tuft < 3; tuft++) parts.spikes.setColorAt(index * 3 + tuft, color.setHex(hair));
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
      parts.sideLocks.setColorAt(slot, color.setHex(hair));
      parts.braids.setColorAt(slot, color.setHex(hair));
      parts.braidTies.setColorAt(slot, color.setHex(bow));
      parts.bowLoops.setColorAt(slot, color.setHex(bow));
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
  const out = new THREE.Matrix4();
  const local = new THREE.Matrix4();
  const euler = new THREE.Euler();
  const quat = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const scale = new THREE.Vector3();
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
    for (let side = 0; side < 2; side++) {
      const sign = side === 0 ? -1 : 1;
      const slot = index * 2 + side;
      put(parts.ears, slot, at(out, head, sign * 0.175, -0.01, 0, 0, 0, 0, scale.set(0.6, 1, 0.8)));
      put(parts.eyes, slot, at(out, head, sign * 0.062, 0.0, 0.163, 0, 0, 0, scale.set(1, 1.35, 0.6)));
      put(parts.shines, slot, at(out, head, sign * 0.056, 0.012, 0.178));
      put(parts.glasses, slot, at(out, head, sign * 0.062, 0.0, 0.172), look.glasses);

      // Girls: locks framing the face (loose hair), or braids falling forward over the shoulders.
      put(parts.sideLocks, slot, at(out, head, sign * 0.168, -0.13, 0.05, 0, 0, sign * -0.06), look.girl && !look.braids);
      at(joint, head, sign * 0.14, -0.1, -0.02, -0.3 + swing * sign * 0.12, 0, sign * 0.24);
      put(parts.braids, slot, joint, look.braids);
      put(parts.braidTies, slot, at(out, joint, 0, -0.33, 0), look.braids);
      // Hair bow on the side of the crown.
      put(parts.bowLoops, slot, at(out, head, 0.1 + sign * 0.055, 0.16, 0.04, 0, 0, -0.55 + sign * 0.5, scale.set(1.25, 0.75, 0.5)), look.girl);
    }
    put(parts.hairCap, index, at(out, head, 0, 0.008, -0.004));
    put(parts.hairBack, index, head, look.girl);
    put(parts.hairNape, index, head, !look.girl);
    put(parts.bowKnot, index, at(out, head, 0.1, 0.16, 0.045), look.girl);
    // Loose long hair sways a little behind the walk.
    put(parts.longHair, index, at(out, head, 0, -0.25, -0.01, Math.abs(swing) * 0.08), look.girl && !look.braids);
    // Boys: three spikes along the front of the crown.
    for (let tuft = 0; tuft < 3; tuft++) {
      const x = (tuft - 1) * 0.07;
      put(parts.spikes, index * 3 + tuft, at(out, head, x, 0.175 - Math.abs(x) * 0.25, 0.07, -0.45, 0, -x * 2.2), !look.girl);
    }

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
