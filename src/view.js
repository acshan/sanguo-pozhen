import * as T from "../vendor/three.module.js";
import { rng } from "./math.js";
function texture(kind) {
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const x = c.getContext("2d");
  const hero = kind === "hero",
    ally = kind === "ally",
    boss = kind === "boss";
  const armor = hero
      ? "#d6e3e6"
      : ally
        ? "#687e86"
        : boss
          ? "#563c50"
          : kind === "archer"
            ? "#a16a59"
            : kind === "charger"
              ? "#b5a384"
              : "#97733d",
    cloth = hero ? "#5cafd7" : ally ? "#75b4a3" : "#dfad43";
  const r = (a, b, w, h, color) => {
    x.fillStyle = color;
    x.fillRect(a, b, w, h);
  };
  r(10, 25, 5, 6, "#1c2329");
  r(18, 25, 5, 6, "#1c2329");
  r(8, 12, 17, 14, "#202835");
  r(10, 12, 13, 13, armor);
  r(7, 15, 4, 8, armor);
  r(23, 15, 4, 8, armor);
  r(12, 7, 10, 7, "#e1b798");
  r(10, 3, 14, 6, armor);
  r(9, 6, 16, 3, armor);
  r(15, 1, 4, 4, cloth);
  r(20, 1, 7, 2, cloth);
  r(14, 10, 2, 2, "#29303a");
  r(20, 10, 2, 2, "#29303a");
  r(11, 21, 13, 3, cloth);
  r(15, 13, 3, 7, "#e8cb88");
  if (hero) {
    r(26, 5, 2, 25, "#8a6544");
    r(25, 1, 4, 7, "#e5f5f5");
    r(25, 8, 4, 3, cloth);
    r(6, 13, 3, 15, cloth);
  } else if (ally || kind === "archer") {
    r(3, 15, 4, 2, "#e6cda0");
    r(2, 13, 2, 9, "#966b44");
  } else {
    r(27, 10, 2, 21, "#695440");
    r(26, 5, 4, 7, "#b9c1ba");
  }
  const t = new T.CanvasTexture(c);
  t.magFilter = t.minFilter = T.NearestFilter;
  t.colorSpace = T.SRGBColorSpace;
  return t;
}
export class View {
  constructor(canvas) {
    this.renderer = new T.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.scene = new T.Scene();
    this.scene.background = new T.Color("#17232c");
    this.scene.fog = new T.Fog("#17232c", 25, 53);
    this.camera = new T.PerspectiveCamera(46, 1, 0.1, 100);
    this.scene.add(new T.HemisphereLight("#c4dbed", "#4f3d29", 2.7));
    const sun = new T.DirectionalLight("#ffdba8", 2);
    sun.position.set(-10, 20, 5);
    this.scene.add(sun);
    this.materials = {};
    this.meshes = new Map();
    this.fx = new Map();
    this.geos = {};
    const mat = (color) =>
      new T.MeshStandardMaterial({ color, roughness: 1, flatShading: true });
    const earth = mat("#4f5546");
    const ground = new T.Mesh(new T.PlaneGeometry(52, 52), earth);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    this.scene.add(ground);
    const road = new T.Mesh(new T.PlaneGeometry(6, 47), mat("#77705a"));
    road.rotation.x = -Math.PI / 2;
    road.position.y = 0.001;
    this.scene.add(road);
    const random = rng(23);
    const dummy = new T.Object3D();
    const grass = new T.InstancedMesh(
      new T.ConeGeometry(0.09, 0.35, 3),
      mat("#868166"),
      350,
    );
    for (let i = 0; i < 350; i++) {
      dummy.position.set((random() - 0.5) * 48, 0.12, (random() - 0.5) * 48);
      dummy.updateMatrix();
      grass.setMatrixAt(i, dummy.matrix);
    }
    this.scene.add(grass);
    const wood = mat("#594636"),
      canvasMat = mat("#80734e");
    for (const [x, z] of [
      [-10, -10],
      [10, -10],
      [-12, 7],
      [12, 7],
      [-10, 17],
      [10, 17],
    ]) {
      const tent = new T.Mesh(new T.ConeGeometry(2.5, 2.8, 4), canvasMat);
      tent.rotation.y = Math.PI / 4;
      tent.position.set(x, 1.4, z);
      this.scene.add(tent);
      const door = new T.Mesh(new T.BoxGeometry(0.7, 1, 0.1), wood);
      door.position.set(x, 0.5, z + 1.8);
      this.scene.add(door);
    }
    const fence = new T.InstancedMesh(new T.ConeGeometry(0.2, 2, 4), wood, 100);
    for (let i = 0; i < 100; i++) {
      const side = Math.floor(i / 25),
        n = i % 25;
      dummy.position.set(
        side < 2 ? (side ? 23 : -23) : (n - 12) * 1.9,
        0.8,
        side < 2 ? (n - 12) * 1.9 : side === 2 ? 23 : -23,
      );
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      fence.setMatrixAt(i, dummy.matrix);
    }
    this.scene.add(fence);
    for (const [x, z] of [
      [-4, -7],
      [4, -7],
      [-4, 4],
      [4, 4],
    ]) {
      const pole = new T.Mesh(new T.CylinderGeometry(0.09, 0.12, 2, 5), wood);
      pole.position.set(x, 1, z);
      this.scene.add(pole);
      const fire = new T.Mesh(
        new T.OctahedronGeometry(0.25),
        new T.MeshBasicMaterial({ color: "#ffc969" }),
      );
      fire.position.set(x, 2.15, z);
      this.scene.add(fire);
    }
    for (const k of ["hero", "soldier", "archer", "charger", "boss", "ally"])
      this.materials[k] = new T.SpriteMaterial({
        map: texture(k),
        transparent: true,
        depthWrite: false,
      });
    this.geos.gem = new T.OctahedronGeometry(0.14);
    this.geos.shot = new T.BoxGeometry(0.08, 0.08, 0.6);
    this.geos.spear = new T.BoxGeometry(0.2, 0.12, 1);
    this.geos.echo = new T.RingGeometry(0.4, 0.65, 20);
    this.geos.musou = new T.RingGeometry(7.6, 8, 48);
    this.geos.impact = new T.CircleGeometry(3, 40);
    this.materials.gem = new T.MeshBasicMaterial({ color: "#78ded0" });
    this.materials.shot = new T.MeshBasicMaterial({ color: "#e8d5a3" });
    this.materials.hostile = new T.MeshBasicMaterial({ color: "#ff8f6a" });
    this.hero = new T.Sprite(this.materials.hero);
    this.hero.center.set(0.5, 0.05);
    this.scene.add(this.hero);
    this.flag = new T.Group();
    const pole = new T.Mesh(new T.CylinderGeometry(0.08, 0.08, 4, 6), wood);
    pole.position.y = 2;
    this.flag.add(pole);
    this.banner = new T.Mesh(
      new T.PlaneGeometry(1.8, 1.1),
      new T.MeshBasicMaterial({ color: "#e6ae52", side: T.DoubleSide }),
    );
    this.banner.position.set(0.9, 3.2, 0);
    this.flag.add(this.banner);
    this.flag.position.set(0, 0, -5);
    this.scene.add(this.flag);
    this.flagRing = new T.Mesh(
      new T.RingGeometry(2.85, 3, 48),
      new T.MeshBasicMaterial({
        color: "#e6ae52",
        transparent: true,
        opacity: 0.6,
        side: T.DoubleSide,
      }),
    );
    this.flagRing.rotation.x = -Math.PI / 2;
    this.flagRing.position.set(0, 0.03, -5);
    this.scene.add(this.flagRing);
    this.warning = new T.Mesh(
      new T.CircleGeometry(3, 48),
      new T.MeshBasicMaterial({
        color: "#ef7957",
        transparent: true,
        opacity: 0.4,
        depthWrite: false,
      }),
    );
    this.warning.rotation.x = -Math.PI / 2;
    this.scene.add(this.warning);
    this.resize = () => {
      const w = canvas.clientWidth,
        h = canvas.clientHeight;
      if (!w || !h) return;
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    };
    this.observer = new ResizeObserver(this.resize);
    this.observer.observe(canvas);
    this.resize();
  }
  sync(w) {
    const p = w.player;
    this.hero.position.set(p.x, 0.03, p.z);
    this.hero.scale.setScalar(w.breakthrough ? 2.6 : 2.15);
    this.hero.material.color.set(p.invul > 0 ? "#9ae2ff" : "#ffffff");
    this.banner.material.color.set(w.flag.captured ? "#6ed6c8" : "#e6ae52");
    this.flagRing.material.color.copy(this.banner.material.color);
    this.flagRing.rotation.z = w.flag.progress * 0.12;
    this.camera.position.set(p.x, 19, p.z + 17);
    this.camera.lookAt(p.x, 0, p.z - 1);
    const seen = new Set();
    for (const [kind, list] of [
      ["enemy", w.enemies],
      ["gem", w.gems],
      ["shot", w.shots],
      ["ally", w.ally ? [{ ...w.ally, id: "ally" }] : []],
    ])
      for (const o of list) {
        const key = kind + o.id;
        seen.add(key);
        let m = this.meshes.get(key);
        if (!m) {
          m =
            kind === "enemy" || kind === "ally"
              ? new T.Sprite(this.materials[kind === "ally" ? "ally" : o.type])
              : new T.Mesh(
                  this.geos[kind],
                  this.materials[
                    kind === "shot" && o.hostile ? "hostile" : kind
                  ],
                );
          if (m.isSprite) m.center.set(0.5, 0.05);
          this.meshes.set(key, m);
          this.scene.add(m);
        }
        m.position.set(
          o.x,
          kind === "gem" ? 0.2 : kind === "shot" ? 0.8 : 0,
          o.z,
        );
        if (m.isSprite) {
          m.scale.setScalar(o.type === "boss" ? 3.6 : 1.9);
          m.material.color.set(o.flash > 0 ? "#ffbc9c" : "#ffffff");
        }
        if (kind === "shot") m.rotation.y = Math.atan2(o.vx, o.vz);
      }
    for (const [key, m] of this.meshes)
      if (!seen.has(key)) {
        this.scene.remove(m);
        this.meshes.delete(key);
      }
    const active = new Set();
    for (const e of w.effects) {
      active.add(e.id);
      let m = this.fx.get(e.id);
      if (!m) {
        m = new T.Mesh(
          this.geos[e.kind],
          new T.MeshBasicMaterial({
            color:
              e.kind === "spear"
                ? "#d5f1ff"
                : e.kind === "musou"
                  ? "#ffe1a0"
                  : "#77bcda",
            transparent: true,
            opacity: 0.7,
            side: T.DoubleSide,
            depthWrite: false,
          }),
        );
        if (e.kind !== "spear") m.rotation.x = -Math.PI / 2;
        this.fx.set(e.id, m);
        this.scene.add(m);
      }
      m.material.opacity = (0.7 * e.life) / e.maxLife;
      if (e.kind === "spear") {
        m.position.set(
          e.x + (e.dx * e.length) / 2,
          0.8,
          e.z + (e.dz * e.length) / 2,
        );
        m.scale.z = e.length;
        m.rotation.y = Math.atan2(e.dx, e.dz);
      } else m.position.set(e.x, 0.08, e.z);
    }
    for (const [id, m] of this.fx)
      if (!active.has(id)) {
        this.scene.remove(m);
        m.material.dispose();
        this.fx.delete(id);
      }
    const b = w.enemies.find((e) => e.type === "boss" && e.wind > 0);
    this.warning.visible = !!b;
    if (b) {
      this.warning.position.set(b.tx, 0.05, b.tz);
      this.warning.material.opacity = 0.25 + 0.45 * (1 - b.wind / 1.1);
    }
    this.renderer.render(this.scene, this.camera);
  }
  dispose() {
    this.observer.disconnect();
    const gs = new Set(),
      ms = new Set();
    this.scene.traverse((o) => {
      if (o.geometry) gs.add(o.geometry);
      if (o.material) ms.add(o.material);
    });
    Object.values(this.geos).forEach((g) => gs.add(g));
    Object.values(this.materials).forEach((m) => ms.add(m));
    gs.forEach((g) => g.dispose());
    ms.forEach((m) => {
      m.map?.dispose();
      m.dispose();
    });
    this.renderer.dispose();
  }
}
