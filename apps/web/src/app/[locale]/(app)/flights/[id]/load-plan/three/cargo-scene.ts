import * as T from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  AIRFRAME_DISPLAY,
  type CargoDeck,
  type CargoPlacement,
  type CargoSceneData,
} from "@/lib/aircraft-3d-layout";
import { formatWeight } from "@/lib/format-number";
import { createAircraftModel, disposeObject } from "./aircraft-model";

export interface SceneOptions {
  data: CargoSceneData;
  deck: CargoDeck;
  row: string;
  selected: string | null;
  labels: boolean;
  shell: boolean;
  dark: boolean;
}
interface CargoVisual {
  group: T.Group;
  label: T.Sprite;
  placement: CargoPlacement;
  signature: string;
  started: number | null;
}

/** Owns only visualization resources. Never writes the draft, computes W&B,
 * or runs a render loop while idle/hidden. The React form owns every edit. */
export class CargoScene {
  private scene = new T.Scene();
  private renderer: T.WebGLRenderer;
  private camera = new T.PerspectiveCamera(35, 1, 0.1, 500);
  private controls: OrbitControls;
  private aircraft: ReturnType<typeof createAircraftModel>;
  private environment: T.WebGLRenderTarget;
  private slots = new T.Group();
  private cargos = new Map<string, CargoVisual>();
  private ray = new T.Raycaster();
  private pointerDown: { x: number; y: number } | null = null;
  private resizeObserver: ResizeObserver;
  private visibilityObserver: IntersectionObserver;
  private motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  private frame: number | null = null;
  private inView = true;
  private disposed = false;
  private initialized = false;
  private selected: string | null = null;
  private deck: CargoDeck = "MAIN";
  private ground: T.Mesh;

  constructor(
    private host: HTMLElement,
    private onSelect: (key: string) => void,
    private onError: () => void,
    registration: string,
  ) {
    this.aircraft = createAircraftModel(registration);
    this.renderer = new T.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "low-power",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    const studio = new RoomEnvironment();
    const pmrem = new T.PMREMGenerator(this.renderer);
    this.environment = pmrem.fromScene(studio, 0.04);
    this.scene.environment = this.environment.texture;
    this.scene.environmentIntensity = 0.45;
    studio.dispose();
    pmrem.dispose();
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    host.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.cssText =
      "display:block;width:100%;height:100%;touch-action:none;";
    this.renderer.domElement.setAttribute("aria-hidden", "true");
    this.scene.add(this.aircraft.root, this.slots);
    this.scene.add(new T.HemisphereLight(0xe5f2ff, 0x687581, 1.25));
    const sun = new T.DirectionalLight(0xfff7e8, 3.0);
    sun.position.set(-30, 48, 18);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -44;
    sun.shadow.camera.right = 44;
    sun.shadow.camera.top = 40;
    sun.shadow.camera.bottom = -40;
    sun.shadow.camera.far = 150;
    sun.shadow.normalBias = 0.035;
    sun.shadow.bias = -0.0001;
    this.scene.add(sun);
    this.ground = new T.Mesh(
      new T.PlaneGeometry(1000, 1000),
      new T.MeshStandardMaterial({ color: 0x485662, roughness: 1 }),
    );
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.y = -0.08;
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);
    const grid = new T.GridHelper(160, 40, 0x73838f, 0x667784);
    grid.position.y = -0.06;
    (grid.material as T.Material).transparent = true;
    (grid.material as T.Material).opacity = 0.35;
    this.scene.add(grid);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 5, 0);
    this.controls.minDistance = 9;
    this.controls.maxDistance = 225;
    this.controls.maxPolarAngle = Math.PI * 0.49;
    this.controls.enableDamping = false;
    this.controls.addEventListener("change", this.invalidate);
    this.resizeObserver = new ResizeObserver(this.resize);
    this.resizeObserver.observe(host);
    this.visibilityObserver = new IntersectionObserver(([entry]) => {
      this.inView = entry?.isIntersecting ?? true;
      this.invalidate();
    });
    this.visibilityObserver.observe(host);
    this.renderer.domElement.addEventListener("pointerdown", this.pointerStart);
    this.renderer.domElement.addEventListener("pointerup", this.pointerEnd);
    this.renderer.domElement.addEventListener("webglcontextlost", this.contextLost);
    document.addEventListener("visibilitychange", this.invalidate);
    this.motion.addEventListener("change", this.invalidate);
    this.reset();
    this.resize();
  }

  private resize = () => {
    const { clientWidth: w, clientHeight: h } = this.host;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    const aspectChanged = Math.abs(this.camera.aspect - w / h) > 0.03;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (aspectChanged) this.reset();
    this.invalidate();
  };
  reset = () => {
    const aspect = this.host.clientWidth / Math.max(1, this.host.clientHeight);
    const scale = Math.max(1, 1.8 / Math.max(0.6, aspect));
    this.camera.position.set(-36 * scale, 28 * scale, 52 * scale);
    this.controls.target.set(0, 5, 0);
    this.controls.update();
    this.invalidate();
  };
  top = () => {
    this.camera.position.set(0, Math.max(106, 106 / Math.max(0.6, this.camera.aspect)), 0.01);
    this.controls.target.set(0, 5, 0);
    this.controls.update();
    this.invalidate();
  };
  zoom = (factor: number) => {
    const offset = this.camera.position.clone().sub(this.controls.target);
    offset.setLength(T.MathUtils.clamp(offset.length() * factor, 9, 225));
    this.camera.position.copy(this.controls.target).add(offset);
    this.controls.update();
    this.invalidate();
  };
  focus = () => {
    const cargo = this.selected ? this.cargos.get(this.selected) : null;
    if (!cargo) return;
    const { x, z } = cargo.placement;
    const y = this.deck === "MAIN" ? AIRFRAME_DISPLAY.mainFloor : AIRFRAME_DISPLAY.lowerFloor;
    this.controls.target.set(x, y, z);
    this.camera.position.set(x - 8, y + 10, z + 13);
    this.controls.update();
    this.invalidate();
  };
  private pointerStart = (e: PointerEvent) => {
    this.pointerDown = { x: e.clientX, y: e.clientY };
  };
  private pointerEnd = (e: PointerEvent) => {
    if (
      !this.pointerDown ||
      Math.hypot(e.clientX - this.pointerDown.x, e.clientY - this.pointerDown.y) > 6
    )
      return;
    this.pointerDown = null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.ray.setFromCamera(
      new T.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        (-(e.clientY - rect.top) / rect.height) * 2 + 1,
      ),
      this.camera,
    );
    const targets: T.Object3D[] = [...this.slots.children];
    for (const cargo of this.cargos.values()) if (cargo.group.visible) targets.push(cargo.group);
    for (const hit of this.ray.intersectObjects(targets, true)) {
      let object: T.Object3D | null = hit.object;
      while (object && !object.userData.key) object = object.parent;
      if (object?.userData.key) {
        this.onSelect(object.userData.key as string);
        return;
      }
    }
  };
  private contextLost = (event: Event) => {
    event.preventDefault();
    this.onError();
  };

  update(options: SceneOptions) {
    this.deck = options.deck;
    this.selected = options.selected;
    this.scene.background = new T.Color(options.dark ? 0x17252f : 0x87949e);
    (this.ground.material as T.MeshStandardMaterial).color.set(options.dark ? 0x243640 : 0x485662);
    this.aircraft.shell.visible = options.shell;
    this.aircraft.ribs.visible = !options.shell;
    this.aircraft.lowerShell.visible = options.shell || options.deck === "MAIN";
    this.aircraft.main.visible = options.deck === "MAIN";
    this.aircraft.lower.visible = true;
    const keys = new Set(options.data.loaded.map((p) => p.key));
    for (const [key, visual] of this.cargos)
      if (!keys.has(key)) {
        this.scene.remove(visual.group);
        disposeObject(visual.group);
        this.cargos.delete(key);
      }
    for (const p of options.data.loaded) {
      const signature = JSON.stringify([
        p.cell.weight,
        p.cell.uldCode,
        p.cell.state,
        p.x,
        p.z,
        p.length,
        p.width,
      ]);
      let visual = this.cargos.get(p.key);
      if (visual?.signature !== signature) {
        const previous = visual;
        const newLoad = !previous;
        if (previous) {
          this.scene.remove(previous.group);
          disposeObject(previous.group);
        }
        visual = this.createCargo(p, signature);
        // Persisted cargo is already aboard. Only newly assigned cargo moves
        // through the loading door; changing a weight never reloads the ULD.
        visual.started =
          newLoad && this.initialized && !this.motion.matches ? performance.now() : null;
        this.cargos.set(p.key, visual);
        this.scene.add(visual.group);
      }
      visual.group.visible = p.deck === options.deck;
      visual.label.visible = options.labels || p.key === options.selected;
      const outline = visual.group.getObjectByName("selection");
      if (outline) outline.visible = p.key === options.selected;
    }
    disposeObject(this.slots);
    this.slots.clear();
    for (const p of options.data.placements.filter(
      (p) => p.deck === options.deck && p.cell.uldType === options.row && p.cell.weight === null,
    )) {
      const y = p.deck === "MAIN" ? AIRFRAME_DISPLAY.mainFloor : AIRFRAME_DISPLAY.lowerFloor;
      const selected = p.key === options.selected,
        blocked = p.cell.state === "BLOCKED";
      const tile = new T.Mesh(
        new T.BoxGeometry(Math.max(0.2, p.length - 0.08), 0.035, p.width - 0.08),
        new T.MeshStandardMaterial({
          color: selected ? 0x2e9fcb : blocked ? 0x978a7e : 0x5faba0,
          transparent: true,
          opacity: selected ? 0.8 : 0.22,
          roughness: 0.9,
        }),
      );
      tile.position.set(p.x, y + 0.07, p.z);
      tile.userData.key = p.key;
      this.slots.add(tile);
      const edge = new T.LineSegments(
        new T.EdgesGeometry(tile.geometry),
        new T.LineBasicMaterial({ color: selected ? 0x0076b5 : blocked ? 0x887664 : 0x408477 }),
      );
      tile.add(edge);
      const label = this.makeLabel(p.cell.code, blocked ? "×" : "", false);
      label.scale.set(1.3, 0.43, 1);
      label.position.set(p.x, y + 0.18, p.z);
      label.userData.key = p.key;
      label.visible = options.labels && !options.shell;
      this.slots.add(label);
    }
    this.initialized = true;
    this.invalidate();
  }

  private makeLabel(code: string, weight: string, danger: boolean) {
    const canvas = document.createElement("canvas");
    canvas.width = 384;
    canvas.height = 112;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = danger ? "#a52d34" : "#173844";
    ctx.beginPath();
    ctx.roundRect(2, 2, 380, 108, 16);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.font = "600 43px system-ui";
    ctx.fillText(code, 192, weight ? 47 : 70);
    if (weight) {
      ctx.font = "500 36px system-ui";
      ctx.fillStyle = "#e4f1ef";
      ctx.fillText(weight, 192, 88);
    }
    const texture = new T.CanvasTexture(canvas);
    texture.colorSpace = T.SRGBColorSpace;
    const sprite = new T.Sprite(
      new T.SpriteMaterial({ map: texture, depthTest: false, depthWrite: false }),
    );
    sprite.scale.set(4.0, 1.17, 1);
    sprite.renderOrder = 4;
    return sprite;
  }
  private createCargo(p: CargoPlacement, signature: string): CargoVisual {
    const group = new T.Group();
    group.userData.key = p.key;
    group.name = p.key;
    const y = p.deck === "MAIN" ? AIRFRAME_DISPLAY.mainFloor : AIRFRAME_DISPLAY.lowerFloor;
    group.position.set(p.x, y, p.z);
    const length = Math.max(0.3, p.length - 0.14),
      width = Math.max(0.3, p.width - 0.14),
      height = p.deck === "MAIN" ? 2.1 : 1.3;
    const danger = p.cell.state === "OVERLOADED";
    const metal = new T.MeshStandardMaterial({ color: 0xa8b7bf, metalness: 0.6, roughness: 0.4 });
    const crate = new T.MeshStandardMaterial({
      color: danger ? 0xb95346 : p.deck === "LOWER" ? 0xb4c7ce : 0xc7a87d,
      roughness: 0.85,
    });
    const strap = new T.MeshStandardMaterial({
      color: danger ? 0x672b2b : 0x355d54,
      roughness: 0.8,
    });
    const addBox = (
      w: number,
      h: number,
      d: number,
      x: number,
      yy: number,
      z: number,
      mat: T.Material,
    ) => {
      const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat);
      m.position.set(x, yy, z);
      m.castShadow = true;
      m.receiveShadow = true;
      group.add(m);
      return m;
    };
    addBox(length, 0.13, width, 0, 0.065, 0, metal);
    const rows = p.deck === "MAIN" ? 2 : 1,
      cols = Math.max(1, Math.ceil(length / 1.5));
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        addBox(
          length / cols - 0.035,
          (height - 0.16) / rows - 0.035,
          width - 0.06,
          -length / 2 + ((c + 0.5) * length) / cols,
          0.16 + ((r + 0.5) * (height - 0.16)) / rows,
          0,
          crate,
        );
      }
    for (const x of [-length * 0.3, length * 0.3]) {
      addBox(0.06, 0.028, width, x, height + 0.02, 0, strap);
      for (const z of [-width / 2, width / 2])
        addBox(0.06, height, 0.025, x, height / 2 + 0.08, z, strap);
    }
    const outline = new T.LineSegments(
      new T.EdgesGeometry(new T.BoxGeometry(length + 0.1, height + 0.08, width + 0.1)),
      new T.LineBasicMaterial({ color: 0x039cc5 }),
    );
    outline.position.y = height / 2 + 0.08;
    outline.name = "selection";
    group.add(outline);
    const label = this.makeLabel(p.cell.code, `${formatWeight(p.cell.weight!)} kg`, danger);
    label.position.set(0, height + 0.75, 0);
    group.add(label);
    return { group, label, placement: p, signature, started: null };
  }

  private invalidate = () => {
    if (this.disposed) return;
    if (document.hidden || !this.inView) {
      if (this.frame !== null) cancelAnimationFrame(this.frame);
      this.frame = null;
      return;
    }
    if (this.frame === null) this.frame = requestAnimationFrame(this.render);
  };
  private render = (now: number) => {
    this.frame = null;
    if (this.disposed) return;
    let moving = false;
    for (const cargo of this.cargos.values()) {
      if (cargo.started === null) continue;
      const t = this.motion.matches ? 1 : Math.min(1, (now - cargo.started) / 1200);
      const p = cargo.placement;
      const doorX = p.deck === "MAIN" ? -18 : p.x < 0 ? -17 : 14;
      // Straight roller-bed movement: through the side door, then along the
      // deck, with no decorative bounce or weight-dependent dimensions.
      cargo.group.position.x = t < 0.3 ? doorX : T.MathUtils.lerp(doorX, p.x, (t - 0.3) / 0.7);
      cargo.group.position.z = t < 0.3 ? T.MathUtils.lerp(6, p.z, t / 0.3) : p.z;
      if (t === 1) cargo.started = null;
      else moving = true;
    }
    this.renderer.render(this.scene, this.camera);
    if (moving) this.invalidate();
  };
  dispose() {
    this.disposed = true;
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    this.visibilityObserver.disconnect();
    document.removeEventListener("visibilitychange", this.invalidate);
    this.motion.removeEventListener("change", this.invalidate);
    this.renderer.domElement.removeEventListener("pointerdown", this.pointerStart);
    this.renderer.domElement.removeEventListener("pointerup", this.pointerEnd);
    this.renderer.domElement.removeEventListener("webglcontextlost", this.contextLost);
    this.controls.dispose();
    disposeObject(this.scene);
    this.environment.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }
}
