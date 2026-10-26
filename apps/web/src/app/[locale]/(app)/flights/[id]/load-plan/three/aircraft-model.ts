import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { createAirlineMarkTexture } from "./airline-mark";
import { AIRFRAME_DISPLAY } from "@/lib/aircraft-3d-layout";

// Visual proportions from Airbus A330-200's published dimensions (58.82 m
// length, 60.30 m span, 5.64 m fuselage). These are not W&B/clearance inputs.
// https://www.aircraft.airbus.com/en/aircraft/a330/a330-200
const NOSE = -30.3;
const TAIL = 28.52;
const BODY_Y = 5.05;
const RADIUS = 2.82;
const CUT_FRONT = -22;
const CUT_BACK = 21.0;
type Profile = { x: number; y: number; ry: number; rz: number };
type WingStation = { span: number; lead: number; trail: number; rise: number; thickness: number };

/** A locally generated A330-200P2F visual model; no remote assets or runtime
 * downloads. Physical envelopes still belong to the versioned AHM data. */
export function createAircraftModel(registration: string) {
  const root = new T.Group();
  const shell = new T.Group();
  const lowerShell = new T.Group();
  const ribs = new T.Group();
  const main = new T.Group();
  const lower = new T.Group();
  root.add(shell, lowerShell, ribs, main, lower);
  const paint = new T.MeshPhysicalMaterial({
    color: 0xe7ecef,
    metalness: 0.12,
    roughness: 0.32,
    clearcoat: 0.45,
    clearcoatRoughness: 0.25,
    side: T.DoubleSide,
  });
  const wingPaint = new T.MeshStandardMaterial({
    color: 0xc1cbd0,
    metalness: 0.3,
    roughness: 0.42,
    side: T.DoubleSide,
  });
  const controls = new T.MeshStandardMaterial({
    color: 0xa4b2bc,
    metalness: 0.38,
    roughness: 0.43,
    side: T.DoubleSide,
  });
  const green = new T.MeshPhysicalMaterial({
    color: 0x006b44,
    metalness: 0.2,
    roughness: 0.3,
    clearcoat: 0.5,
    side: T.DoubleSide,
  });
  const chrome = new T.MeshStandardMaterial({
    color: 0xc0cbd1,
    metalness: 0.88,
    roughness: 0.23,
    side: T.DoubleSide,
  });
  const steel = new T.MeshStandardMaterial({
    color: 0x73818a,
    metalness: 0.7,
    roughness: 0.36,
    side: T.DoubleSide,
  });
  const rubber = new T.MeshStandardMaterial({ color: 0x15191d, roughness: 0.88 });
  const dark = new T.MeshStandardMaterial({
    color: 0x1a252e,
    metalness: 0.4,
    roughness: 0.56,
    side: T.DoubleSide,
  });
  const glass = new T.MeshPhysicalMaterial({
    color: 0x172a35,
    metalness: 0.12,
    roughness: 0.22,
    clearcoat: 1,
    side: T.DoubleSide,
  });
  const liner = new T.MeshStandardMaterial({
    color: 0xa8b3b7,
    roughness: 0.82,
    side: T.DoubleSide,
  });
  const seam = new T.LineBasicMaterial({ color: 0x61727e, transparent: true, opacity: 0.42 });

  function mesh(
    geometry: T.BufferGeometry,
    material: T.Material | T.Material[],
    parent: T.Object3D = root,
  ) {
    const object = new T.Mesh(geometry, material);
    object.castShadow = true;
    object.receiveShadow = true;
    parent.add(object);
    return object;
  }
  function box(
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    material: T.Material,
    parent: T.Object3D = root,
  ) {
    const object = mesh(new T.BoxGeometry(w, h, d), material, parent);
    object.position.set(x, y, z);
    return object;
  }
  function ellipsoid(
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    material: T.Material,
    parent: T.Object3D = root,
  ) {
    const object = mesh(new T.SphereGeometry(1, 28, 16), material, parent);
    object.position.set(x, y, z);
    object.scale.set(sx, sy, sz);
    return object;
  }
  function line(
    points: T.Vector3[],
    parent: T.Object3D = root,
    material: T.LineBasicMaterial = seam,
  ) {
    const object = new T.Line(new T.BufferGeometry().setFromPoints(points), material);
    parent.add(object);
    return object;
  }
  function rod(
    a: T.Vector3,
    b: T.Vector3,
    r: number,
    material: T.Material,
    parent: T.Object3D = root,
  ) {
    const delta = b.clone().sub(a);
    const object = mesh(new T.CylinderGeometry(r, r, delta.length(), 12), material, parent);
    object.position.copy(a).add(b).multiplyScalar(0.5);
    object.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), delta.normalize());
    return object;
  }
  const profiles: Profile[] = [];
  // Separate crown, belly and planform curves give the A330 its low radome,
  // rising windshield brow and full-width cockpit shoulders. A circular cone
  // incorrectly makes the glazing look like passenger windows on the side.
  const noseStations = [
    [NOSE, 4.69, 4.67, 0.015],
    [-30.0, 5.35, 3.9, 0.68],
    [-29.3, 5.88, 3.05, 1.38],
    [-28.4, 6.48, 2.5, 2.05],
    [-27.5, 7.3, 2.29, 2.48],
    [-26.3, 7.75, 2.23, 2.69],
    [-24.8, 7.87, 2.23, 2.8],
    [-22.8, 7.87, 2.23, RADIUS],
  ];
  for (let i = 0; i < noseStations.length - 1; i++) {
    const a = noseStations[i]!,
      b = noseStations[i + 1]!;
    const previous = noseStations[Math.max(0, i - 1)]!;
    const next = noseStations[Math.min(noseStations.length - 1, i + 2)]!;
    for (let j = 0; j < 12; j++) {
      const t = j / 12,
        span = b[0]! - a[0]!;
      const interpolate = (column: number) => {
        // Monotone Hermite tangents avoid dents at the barrel transition.
        const slope = (b[column]! - a[column]!) / span;
        const before = i ? (a[column]! - previous[column]!) / (a[0]! - previous[0]!) : slope;
        const after =
          i < noseStations.length - 2 ? (next[column]! - b[column]!) / (next[0]! - b[0]!) : slope;
        const m1 = before * slope > 0 ? (2 * before * slope) / (before + slope) : 0;
        const m2 = after * slope > 0 ? (2 * after * slope) / (after + slope) : 0;
        return (
          (2 * t * t * t - 3 * t * t + 1) * a[column]! +
          (t * t * t - 2 * t * t + t) * span * m1 +
          (-2 * t * t * t + 3 * t * t) * b[column]! +
          (t * t * t - t * t) * span * m2
        );
      };
      const top = interpolate(1),
        bottom = interpolate(2);
      profiles.push({
        x: a[0]! + span * (i === 0 ? t * t : t),
        y: (top + bottom) / 2,
        ry: (top - bottom) / 2,
        rz: interpolate(3),
      });
    }
  }
  profiles.push({ x: -22.8, y: BODY_Y, ry: RADIUS, rz: RADIUS });
  for (let x = -22; x <= 17; x += 1) profiles.push({ x, y: BODY_Y, ry: RADIUS, rz: RADIUS });
  const tailCurve = new T.CubicBezierCurve(
    new T.Vector2(17, RADIUS),
    new T.Vector2(23, RADIUS),
    new T.Vector2(27.1, 0.5),
    new T.Vector2(TAIL, 0.12),
  );
  for (let i = 1; i <= 60; i++) {
    const t = i / 60,
      p = tailCurve.getPoint(t);
    profiles.push({ x: p.x, y: BODY_Y + 1.1 * t, ry: p.y, rz: p.y * 0.98 });
  }
  function sectionAt(x: number): Profile {
    const i = profiles.findIndex((p) => p.x >= x);
    if (i <= 0) return profiles[0]!;
    const a = profiles[i - 1]!,
      b = profiles[i]!,
      t = (x - a.x) / (b.x - a.x);
    return {
      x,
      y: T.MathUtils.lerp(a.y, b.y, t),
      ry: T.MathUtils.lerp(a.ry, b.ry, t),
      rz: T.MathUtils.lerp(a.rz, b.rz, t),
    };
  }
  const cockpitPanes = [
    [
      [-28.5, 1.55],
      [-27.75, 0.8],
      [-27.0, 1.0],
      [-27.65, 1.55],
    ],
    [
      [-27.62, 0.77],
      [-26.22, 0.49],
      [-26.08, 0.75],
      [-26.9, 0.99],
    ],
    [
      [-26.1, 0.48],
      [-25.3, 0.39],
      [-25.17, 0.6],
      [-25.98, 0.74],
    ],
  ];
  function rawBodyPoint(x: number, a: number, offset = 0) {
    const p = sectionAt(x);
    return new T.Vector3(x, p.y + Math.sin(a) * (p.ry + offset), Math.cos(a) * (p.rz + offset));
  }
  const cockpitSurfaces = cockpitPanes.map((corners) => {
    const center = corners
      .reduce((p, c) => p.add(new T.Vector2(c[0], c[1])), new T.Vector2())
      .multiplyScalar(0.25);
    const points = corners.map((c) => rawBodyPoint(c[0]!, c[1]!));
    const midpoint = points.reduce((p, c) => p.add(c), new T.Vector3()).multiplyScalar(0.25);
    const normal = points[2]!
      .clone()
      .sub(points[0]!)
      .cross(points[3]!.clone().sub(points[1]!))
      .normalize();
    if (normal.dot(midpoint.clone().sub(new T.Vector3(-24, BODY_Y, 0))) < 0) normal.negate();
    return {
      corners,
      center,
      plane: new T.Plane().setFromNormalAndCoplanarPoint(normal, midpoint),
    };
  });
  function bodyPoint(x: number, a: number, offset = 0) {
    const point = rawBodyPoint(x, a, offset);
    if (x < -29 || x > -24.8 || Math.sin(a) < 0) return point;
    const angle = Math.atan2(Math.sin(a), Math.abs(Math.cos(a)));
    let bestInset = -0.3;
    let bestPlane: T.Plane | null = null;
    for (const { corners, center, plane } of cockpitSurfaces) {
      let inset = 1;
      for (let i = 0; i < corners.length; i++) {
        const p = corners[i]!,
          q = corners[(i + 1) % corners.length]!;
        const dx = q[0]! - p[0]!,
          dy = q[1]! - p[1]!;
        const distance = dx * (angle - p[1]!) - dy * (x - p[0]!);
        const middle = dx * (center.y - p[1]!) - dy * (center.x - p[0]!);
        inset = Math.min(inset, distance / middle);
      }
      if (inset > bestInset) {
        bestInset = inset;
        bestPlane = plane;
      }
    }
    if (bestPlane) {
      // Flat glass and the skin below it share the same surface projection.
      const sign = Math.cos(a) < 0 ? -1 : 1;
      const flat = bestPlane
        .projectPoint(rawBodyPoint(x, angle), new T.Vector3())
        .addScaledVector(bestPlane.normal, offset);
      flat.z *= sign;
      return point.lerp(flat, T.MathUtils.smoothstep(bestInset, -0.3, 0));
    }
    return point;
  }
  function skin(
    from: number,
    to: number,
    start: number,
    sweep: number,
    parent: T.Object3D = root,
    material: T.Material = paint,
    offset = 0,
  ) {
    const samples = [
      sectionAt(from),
      ...profiles.filter((p) => p.x > from && p.x < to),
      sectionAt(to),
    ];
    const vertices: number[] = [],
      indices: number[] = [],
      segments = from < CUT_FRONT ? 160 : 64;
    for (let i = 0; i < samples.length; i++)
      for (let j = 0; j <= segments; j++) {
        const p = samples[i]!,
          a = start + (sweep * j) / segments;
        vertices.push(...bodyPoint(p.x, a, offset).toArray());
        if (i > 0 && j > 0) {
          const b = i * (segments + 1) + j;
          indices.push(b, b - segments - 2, b - 1, b, b - segments - 1, b - segments - 2);
        }
      }
    const geometry = new T.BufferGeometry();
    geometry.setAttribute("position", new T.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return mesh(geometry, material, parent);
  }
  skin(NOSE, CUT_FRONT, 0, Math.PI * 2);
  skin(CUT_BACK, TAIL, 0, Math.PI * 2);
  skin(CUT_FRONT, CUT_BACK, Math.PI / 2, Math.PI);
  skin(CUT_FRONT, CUT_BACK, 0, Math.PI / 2, shell);
  skin(CUT_FRONT, CUT_BACK, -Math.PI / 2, Math.PI / 2, lowerShell);
  // Interior wall is slightly inset from the skin, with frames attached to
  // the retained wall. No hoops float across the opening or obscure the load.
  skin(CUT_FRONT, CUT_BACK, Math.PI / 2, Math.PI, ribs, liner, -0.065);
  for (let x = -21.6; x < CUT_BACK; x += 1.2) {
    const points = Array.from({ length: 25 }, (_, i) =>
      bodyPoint(x, Math.PI / 2 + (Math.PI * i) / 24, -0.1),
    );
    const curve = new T.CatmullRomCurve3(points);
    mesh(new T.TubeGeometry(curve, 24, 0.025, 6, false), steel, ribs);
  }
  for (const x of [CUT_FRONT, CUT_BACK]) {
    const points = Array.from({ length: 65 }, (_, i) =>
      bodyPoint(x, (Math.PI * 2 * i) / 64, -0.025),
    );
    mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points), 64, 0.045, 6, false), chrome, ribs);
  }
  for (const [parent, y, width] of [
    [main, AIRFRAME_DISPLAY.mainFloor, 5.2],
    [lower, AIRFRAME_DISPLAY.lowerFloor, 4.02],
  ] as const) {
    box(43, 0.1, width, -0.5, y - 0.07, 0, liner, parent);
    for (let x = -21.6; x < 21; x += 0.9) {
      box(0.018, 0.012, width - 0.12, x, y + 0.006, 0, steel, parent);
      for (const z of [-width * 0.34, 0, width * 0.34]) {
        box(0.62, 0.028, 0.16, x, y + 0.035, z, dark, parent);
        for (const dx of [-0.18, 0, 0.18]) {
          const roller = mesh(new T.CylinderGeometry(0.035, 0.035, 0.17, 8), chrome, parent);
          roller.rotation.x = Math.PI / 2;
          roller.position.set(x + dx, y + 0.063, z);
        }
      }
    }
    for (const z of [-width / 2 + 0.07, width / 2 - 0.07])
      box(43, 0.08, 0.08, -0.5, y + 0.04, z, steel, parent);
  }

  // Closed, tapered airfoil sections with camber and dihedral, rather than
  // extruded flat triangles. One mesh per wing keeps draw calls bounded.
  function airfoil(
    stations: WingStation[],
    side: number,
    parent: T.Object3D = root,
    vertical = false,
    materials: T.Material[] = [wingPaint, controls, chrome],
  ) {
    const vertices: number[] = [],
      indices: number[] = [],
      n = 40,
      ring = n * 2;
    const point = (s: WingStation, u: number, upper: boolean) => {
      const chord = s.trail - s.lead;
      const thickness =
        5 *
        s.thickness *
        chord *
        (0.2969 * Math.sqrt(u) -
          0.126 * u -
          0.3516 * u * u +
          0.2843 * u * u * u -
          0.1036 * u * u * u * u);
      const camber = vertical ? 0 : 0.012 * chord * Math.sin(Math.PI * u);
      const surface = camber + (upper ? thickness : -thickness);
      return vertical
        ? new T.Vector3(s.lead + chord * u, s.span, surface)
        : new T.Vector3(s.lead + chord * u, s.rise + surface, side * s.span);
    };
    stations.forEach((s) => {
      for (let j = 0; j < ring; j++) {
        const upper = j <= n;
        const u = (1 - Math.cos((Math.PI * (upper ? j : 2 * n - j)) / n)) / 2;
        vertices.push(...point(s, u, upper).toArray());
      }
    });
    const geometry = new T.BufferGeometry();
    const faces: number[][] = [[], [], []];
    for (let i = 1; i < stations.length; i++)
      for (let j = 0; j < ring; j++) {
        const k = (j + 1) % ring,
          a = (i - 1) * ring + j,
          b = (i - 1) * ring + k,
          c = i * ring + j,
          d = i * ring + k;

        const fraction = (1 - Math.cos((Math.PI * (j <= n ? j : 2 * n - j)) / n)) / 2;
        faces[fraction > 0.74 ? 1 : fraction < 0.045 ? 2 : 0]!.push(a, b, c, b, d, c);
      }
    for (const end of [0, stations.length - 1])
      for (let j = 1; j < ring - 1; j++) {
        faces[0]!.push(end * ring, end * ring + j, end * ring + j + 1);
      }
    faces.forEach((face, material) => {
      geometry.addGroup(indices.length, face.length, material);
      indices.push(...face);
    });
    geometry.setAttribute("position", new T.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    mesh(geometry, materials, parent);
    if (!vertical) {
      for (const u of [0.16, 0.64, 0.76])
        line(
          stations.map((s) => point(s, u, true).add(new T.Vector3(0, 0.012, 0))),
          parent,
        );
      for (const s of stations.slice(1, -1))
        line(
          Array.from({ length: 13 }, (_, j) =>
            point(s, 0.16 + (0.84 * j) / 12, true).add(new T.Vector3(0, 0.015, 0)),
          ),
          parent,
        );
    }
  }
  const wingStations: WingStation[] = [
    { span: 2.2, lead: -8.9, trail: 6.6, rise: 3.65, thickness: 0.135 },
    { span: 6.2, lead: -6.7, trail: 7.0, rise: 3.95, thickness: 0.125 },
    { span: 12, lead: -3.2, trail: 7.3, rise: 4.4, thickness: 0.115 },
    { span: 18, lead: 0.8, trail: 8.7, rise: 4.95, thickness: 0.105 },
    { span: 24, lead: 5.0, trail: 10.3, rise: 5.5, thickness: 0.095 },
    { span: 29.4, lead: 9.1, trail: 11.5, rise: 6.05, thickness: 0.085 },
    { span: 30.15, lead: 10.0, trail: 11.5, rise: 8.15, thickness: 0.07 },
  ];
  for (const side of [-1, 1]) {
    airfoil(wingStations, side);
    airfoil(
      [
        { span: 1.4, lead: 17.0, trail: 26.4, rise: 6.45, thickness: 0.1 },
        { span: 5.5, lead: 20.4, trail: 27.1, rise: 6.9, thickness: 0.095 },
        { span: 10.5, lead: 24.4, trail: 28.1, rise: 7.5, thickness: 0.08 },
      ],
      side,
    );
    // Wing-body fillet and flap-track fairings under the trailing edge.
    ellipsoid(0.1, 3.3, side * 2.5, 9, 0.65, 1.4, wingPaint);
    for (const [z, x, y] of [
      [7, 7.4, 3.7],
      [13, 8.3, 4.2],
      [19, 9.9, 4.8],
    ])
      ellipsoid(x!, y!, side * z!, 2.1, 0.22, 0.28, wingPaint);
    const nav = mesh(
      new T.SphereGeometry(0.09, 10, 8),
      new T.MeshBasicMaterial({ color: side > 0 ? 0xd42c29 : 0x45bf8b }),
    );
    nav.position.set(11.4, 8.15, side * 30.15);
    engine(side);
  }
  const finStations: WingStation[] = [
    { span: 6.8, lead: 15.8, trail: 27.3, rise: 0, thickness: 0.1 },
    { span: 8.0, lead: 18.0, trail: 27.2, rise: 0, thickness: 0.09 },
    { span: 15.6, lead: 23.3, trail: 27.0, rise: 0, thickness: 0.075 },
    { span: 17.39, lead: 24.0, trail: 26.9, rise: 0, thickness: 0.065 },
  ];
  airfoil(finStations, 1, root, true, [green, green, green]);
  const whiteMark = markMaterial("#ffffff");
  const greenMark = markMaterial("#08754f");
  for (const side of [-1, 1]) {
    line([new T.Vector3(25.6, 8.2, side * 0.35), new T.Vector3(26.2, 17.1, side * 0.075)]);
    // Project the official circular falcon onto the tapered fin, rather than
    // floating a flat badge beside it. Mirror its direction on the far side.
    decal(whiteMark, (u, v) => {
      const y = 10.3 + v * 4.4,
        x = 22.25 + (side > 0 ? u : 1 - u) * 4.4;
      const index = finStations.findIndex((s) => s.span >= y);
      const a = finStations[index - 1]!,
        b = finStations[index]!;
      const t = (y - a.span) / (b.span - a.span);
      const lead = T.MathUtils.lerp(a.lead, b.lead, t),
        trail = T.MathUtils.lerp(a.trail, b.trail, t);
      const chord = trail - lead,
        f = T.MathUtils.clamp((x - lead) / chord, 0, 1);
      const thickness = T.MathUtils.lerp(a.thickness, b.thickness, t);
      const z =
        5 *
        thickness *
        chord *
        (0.2969 * Math.sqrt(f) -
          0.126 * f -
          0.3516 * f * f +
          0.2843 * f * f * f -
          0.1036 * f * f * f * f);
      return new T.Vector3(x, y, side * (z + 0.018));
    });
  }

  function revolved(profile: number[][], material: T.Material, parent: T.Object3D) {
    const object = mesh(
      new T.LatheGeometry(
        profile.map(([x, r]) => new T.Vector2(r!, x!)),
        64,
      ),
      material,
      parent,
    );
    object.rotation.z = -Math.PI / 2;
    return object;
  }
  function engine(side: number) {
    const group = new T.Group();
    group.position.set(-5.9, 2.55, side * 9.1);
    root.add(group);
    revolved(
      [
        [-2.55, 1.24],
        [-2.5, 1.35],
        [-2.3, 1.46],
        [-1.8, 1.51],
        [-0.8, 1.48],
        [0.8, 1.28],
        [2.15, 0.96],
      ],
      green,
      group,
    );
    revolved(
      [
        [-2.55, 1.24],
        [-2.43, 1.16],
        [-1.5, 1.1],
        [-1.1, 1.07],
      ],
      steel,
      group,
    );
    const lip = mesh(new T.TorusGeometry(1.29, 0.095, 16, 64), chrome, group);
    lip.rotation.y = Math.PI / 2;
    lip.position.x = -2.5;
    const fan = mesh(new T.CylinderGeometry(1.1, 1.1, 0.08, 48), dark, group);
    fan.rotation.z = Math.PI / 2;
    fan.position.x = -1.34;
    // Curved fan blades, recessed behind the intake lip.
    for (let i = 0; i < 28; i++) {
      const a = (i * Math.PI * 2) / 28,
        vertices: number[] = [];
      for (const [r, da, x] of [
        [0.23, 0, -1.48],
        [1.08, 0.39, -1.42],
        [1.08, 0.53, -1.39],
        [0.23, 0.13, -1.45],
      ])
        vertices.push(x!, Math.sin(a + da!) * r!, Math.cos(a + da!) * r!);
      const geometry = new T.BufferGeometry();
      geometry.setAttribute("position", new T.Float32BufferAttribute(vertices, 3));
      geometry.setIndex([0, 1, 2, 0, 2, 3]);
      geometry.computeVertexNormals();
      mesh(geometry, steel, group);
    }
    const spinner = mesh(new T.ConeGeometry(0.27, 0.7, 40), chrome, group);
    spinner.rotation.z = Math.PI / 2;
    spinner.position.x = -1.78;
    revolved(
      [
        [0.7, 0.78],
        [1.9, 0.76],
        [2.9, 0.53],
      ],
      steel,
      group,
    );
    revolved(
      [
        [2.8, 0.5],
        [3.1, 0.49],
      ],
      dark,
      group,
    );
    const exhaust = mesh(new T.ConeGeometry(0.42, 1.7, 32), steel, group);
    exhaust.rotation.z = -Math.PI / 2;
    exhaust.position.x = 2.7;
    // Pylon connects the nacelle to the wing, with swept leading/trailing edges.
    const pylon = new T.Shape();
    pylon.moveTo(-1.3, 1.25);
    pylon.lineTo(-0.6, 2.05);
    pylon.lineTo(3.5, 2.05);
    pylon.lineTo(1.7, 0.85);
    pylon.closePath();
    const mount = mesh(
      new T.ExtrudeGeometry(pylon, {
        depth: 0.38,
        bevelEnabled: true,
        bevelSegments: 2,
        steps: 1,
        bevelSize: 0.05,
        bevelThickness: 0.04,
      }),
      wingPaint,
      group,
    );
    mount.position.z = -0.19;
    for (const x of [-0.9, 1.1])
      line(
        Array.from(
          { length: 49 },
          (_, i) =>
            new T.Vector3(
              x,
              Math.sin((i * Math.PI) / 24) * (x < 0 ? 1.5 : 1.18),
              Math.cos((i * Math.PI) / 24) * (x < 0 ? 1.5 : 1.18),
            ),
        ),
        group,
      );
  }

  // Six swept, tapered panes: the front pair meet at the centre pillar,
  // followed by two side panes per side. Coordinates are (station, angle)
  // on the nose loft, so all frames remain flush with the revised surface.
  const gasket = new T.MeshStandardMaterial({
    color: 0x404c52,
    roughness: 0.55,
    side: T.DoubleSide,
  });
  for (const side of [-1, 1]) {
    for (const corners of cockpitPanes) {
      const center = corners
        .reduce((p, c) => p.add(new T.Vector2(c[0], c[1])), new T.Vector2())
        .multiplyScalar(0.25);
      const pane = (inset: number, offset: number, material: T.Material) => {
        const c = corners.map((p) =>
          new T.Vector2(p[0], p[1]).sub(center).multiplyScalar(inset).add(center),
        );
        const geometry = surfaceGeometry((u, v) => {
          const bottom = c[0]!.clone().lerp(c[1]!, u),
            top = c[3]!.clone().lerp(c[2]!, u);
          const p = bottom.lerp(top, v),
            point = bodyPoint(p.x, p.y, offset);
          point.z *= side;
          return point;
        }, 12);
        const window = mesh(geometry, material);
        window.castShadow = false;
      };
      pane(1, 0.024, gasket);
      pane(0.93, 0.038, glass);
    }
    const wiperPoints = [
      [-28.42, 1.45],
      [-28.1, 1.2],
      [-27.9, 0.88],
    ].map(([x, a]) => {
      const p = bodyPoint(x!, a!, 0.07);
      p.z *= side;
      return p;
    });
    rod(wiperPoints[0]!, wiperPoints[1]!, 0.016, dark);
    rod(wiperPoints[1]!, wiperPoints[2]!, 0.023, dark);
    // A small airline badge stays visible on the retained nose in cutaway mode.
    decal(greenMark, (u, v) => {
      const p = bodyPoint(-23.9 + (side > 0 ? u : 1 - u) * 1.1, -0.1 + v * 0.4, 0.032);
      p.z *= side;
      return p;
    });
    outlineDoor(-24.6, 1.0, 0.02, 0.77, side, root);
    outlineDoor(20.5, 1.0, 0.02, 0.77, side, side > 0 ? shell : root);
    outlineDoor(-19.4, 3.58, 0.02, 1.02, side, side > 0 ? shell : root);
    for (const x of [-17, 13.5])
      outlineDoor(x, 2.4, -0.64, -0.05, side, side > 0 ? lowerShell : root);
    label("TURKMENISTAN", -21.5, -8.6, 0.15, 0.48, side, side > 0 ? shell : root, 0x08754f);
    label("AIRBUS A330-200P2F", -27.0, -24.2, -0.15, -0.02, side, root, 0x4c626d);
    label(registration, 19.3, 23.4, 0.06, 0.27, side, side > 0 ? shell : root, 0x264539);
  }
  function outlineDoor(
    center: number,
    width: number,
    a1: number,
    a2: number,
    side: number,
    parent: T.Object3D,
  ) {
    const points: T.Vector3[] = [];
    for (let i = 0; i <= 12; i++)
      points.push(bodyPoint(center - width / 2 + (width * i) / 12, a1, 0.018));
    for (let i = 0; i <= 12; i++)
      points.push(bodyPoint(center + width / 2, T.MathUtils.lerp(a1, a2, i / 12), 0.018));
    for (let i = 0; i <= 12; i++)
      points.push(bodyPoint(center + width / 2 - (width * i) / 12, a2, 0.018));
    for (let i = 0; i <= 12; i++)
      points.push(bodyPoint(center - width / 2, T.MathUtils.lerp(a2, a1, i / 12), 0.018));
    line(
      points.map((p) => new T.Vector3(p.x, p.y, p.z * side)),
      parent,
    );
    const h = bodyPoint(center + width * 0.27, (a1 + a2) / 2, 0.04);
    box(0.15, 0.045, 0.035, h.x, h.y, h.z * side, steel, parent);
  }
  function surfaceGeometry(point: (u: number, v: number) => T.Vector3, segments = 24) {
    const vertices: number[] = [],
      uv: number[] = [],
      indices: number[] = [];
    for (let j = 0; j <= segments; j++)
      for (let i = 0; i <= segments; i++) {
        vertices.push(...point(i / segments, j / segments).toArray());
        uv.push(i / segments, j / segments);
        if (i && j) {
          const b = j * (segments + 1) + i;
          indices.push(b, b - 1, b - segments - 2, b, b - segments - 2, b - segments - 1);
        }
      }
    const geometry = new T.BufferGeometry();
    geometry.setAttribute("position", new T.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }
  function markMaterial(color: string) {
    return new T.MeshStandardMaterial({
      map: createAirlineMarkTexture(color),
      transparent: true,
      depthWrite: false,
      roughness: 0.5,
      side: T.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
  }
  function decal(material: T.Material, point: (u: number, v: number) => T.Vector3) {
    const badge = mesh(surfaceGeometry(point), material);
    badge.castShadow = false;
  }
  function label(
    text: string,
    x1: number,
    x2: number,
    a1: number,
    a2: number,
    side: number,
    parent: T.Object3D,
    color: number,
  ) {
    const canvas = document.createElement("canvas");
    canvas.width = 2048;
    canvas.height = 192;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = `#${color.toString(16).padStart(6, "0")}`;
    ctx.font = "600 128px Arial";
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.fillText(text, 1024, 100, 2000);
    const map = new T.CanvasTexture(canvas);
    map.colorSpace = T.SRGBColorSpace;
    map.anisotropy = 4;
    const material = new T.MeshStandardMaterial({
      map,
      transparent: true,
      depthWrite: false,
      roughness: 0.4,
      side: T.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
    const geometry = surfaceGeometry((u, v) => {
      const x = T.MathUtils.lerp(x1, x2, side > 0 ? u : 1 - u);
      const p = bodyPoint(x, T.MathUtils.lerp(a1, a2, v), 0.028);
      p.z *= side;
      return p;
    });
    const decal = mesh(geometry, material, parent);
    decal.castShadow = false;
  }
  // Fine panel joins and radome seam; no passenger window strip on the P2F.
  for (const x of [-29.15, -23.4, 19.8, 24.8])
    line(Array.from({ length: 65 }, (_, i) => bodyPoint(x, (Math.PI * 2 * i) / 64, 0.012)));
  for (const side of [-1, 1]) {
    rod(new T.Vector3(-26, 3.85, side * 0.95), new T.Vector3(-27, 3.75, side * 1.3), 0.026, chrome);
    // Dual four-wheel main bogies, with hubs, axles and diagonal braces.
    const z = side * 5.34;
    rod(new T.Vector3(3.1, 3.5, z), new T.Vector3(3.2, 0.9, z), 0.16, chrome);
    rod(new T.Vector3(1.1, 3.2, z - 0.7 * side), new T.Vector3(3.2, 1.15, z), 0.1, steel);
    rod(new T.Vector3(2.4, 0.83, z), new T.Vector3(4.0, 0.83, z), 0.17, steel);
    for (const x of [2.4, 4.0]) for (const dz of [-0.45, 0.45]) wheel(x, 0.62, z + dz, 0.6, 0.34);
    box(2.8, 0.12, 0.82, 3.1, 2.95, z + side * 0.6, paint);
  }
  rod(new T.Vector3(-24.3, 2.7, 0), new T.Vector3(-24.4, 0.55, 0), 0.11, chrome);
  rod(new T.Vector3(-25.3, 2.2, 0), new T.Vector3(-24.4, 1.0, 0), 0.075, steel);
  for (const z of [-0.28, 0.28]) wheel(-24.4, 0.42, z, 0.4, 0.23);
  for (const z of [-0.48, 0.48]) box(1.6, 0.08, 0.38, -24.5, 2.15, z, paint);
  function wheel(x: number, y: number, z: number, r: number, width: number) {
    const tire = mesh(new T.CylinderGeometry(r, r, width, 32), rubber);
    tire.rotation.x = Math.PI / 2;
    tire.position.set(x, y, z);
    for (const sign of [-1, 1]) {
      const hub = mesh(new T.CylinderGeometry(r * 0.49, r * 0.49, 0.025, 24), chrome);
      hub.rotation.x = Math.PI / 2;
      hub.position.set(x, y, z + sign * (width / 2 + 0.01));
      const cap = mesh(new T.CylinderGeometry(r * 0.2, r * 0.2, 0.03, 16), dark);
      cap.rotation.x = Math.PI / 2;
      cap.position.set(x, y, z + sign * (width / 2 + 0.03));
    }
  }
  // APU outlet, beacons and small dorsal aerials finish the silhouette.
  const apu = mesh(new T.CylinderGeometry(0.13, 0.16, 0.3, 24), dark);
  apu.rotation.z = Math.PI / 2;
  apu.position.set(TAIL, 6.14, 0);
  for (const x of [-10, 9]) {
    const antenna = box(0.5, 0.24, 0.055, x, BODY_Y + RADIUS + 0.1, 0, paint, shell);
    antenna.rotation.z = 0.25;
  }
  const beacon = mesh(
    new T.SphereGeometry(0.1, 12, 8),
    new T.MeshStandardMaterial({ color: 0xbb2d20, emissive: 0x4b0800, roughness: 0.3 }),
    shell,
  );
  beacon.position.set(-4, BODY_Y + RADIUS + 0.04, 0);
  // Batch static parts sharing a material within each visibility group.
  // Detail such as rollers and fan blades must not add hundreds of draw calls.
  function batch(parent: T.Object3D) {
    for (const child of [...parent.children]) if (child instanceof T.Group) batch(child);
    const buckets = new Map<T.Material, T.Mesh[]>();
    for (const child of parent.children) {
      if (!(child instanceof T.Mesh) || Array.isArray(child.material) || child.material.transparent)
        continue;
      const list = buckets.get(child.material) ?? [];
      list.push(child);
      buckets.set(child.material, list);
    }
    for (const [material, meshes] of buckets) {
      if (meshes.length < 2) continue;
      const copies = meshes.map((object) => {
        object.updateMatrix();
        const copy = object.geometry.clone().applyMatrix4(object.matrix);
        copy.deleteAttribute("uv");
        copy.clearGroups();
        return copy;
      });
      const joined = mergeGeometries(copies, false);
      copies.forEach((g) => g.dispose());
      if (!joined) continue;
      meshes.forEach((object) => {
        parent.remove(object);
        object.geometry.dispose();
      });
      mesh(joined, material, parent);
    }
  }
  batch(root);
  return { root, shell, lowerShell, main, lower, ribs };
}

export function disposeObject(root: T.Object3D) {
  const geometries = new Set<T.BufferGeometry>(),
    materials = new Set<T.Material>(),
    textures = new Set<T.Texture>();
  root.traverse((o) => {
    const m = o as T.Mesh;
    if (m.geometry) geometries.add(m.geometry);
    for (const material of m.material
      ? Array.isArray(m.material)
        ? m.material
        : [m.material]
      : []) {
      materials.add(material);
      for (const value of Object.values(material))
        if (value instanceof T.Texture) textures.add(value);
    }
  });
  textures.forEach((t) => t.dispose());
  geometries.forEach((g) => g.dispose());
  materials.forEach((m) => m.dispose());
}
