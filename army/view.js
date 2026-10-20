import * as T from "../vendor/three.module.js";
import { TYPES, soldierCount, cellPosition } from "./model.js";
function pixel(type, enemy = false) {
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const x = c.getContext("2d");
  const r = (a, b, w, h, color) => {
    x.fillStyle = color;
    x.fillRect(a, b, w, h);
  };
  const coat = enemy ? "#b36a56" : TYPES[type].color;
  r(11, 24, 4, 7, "#283139");
  r(19, 24, 4, 7, "#283139");
  r(8, 12, 18, 13, "#29313a");
  r(10, 13, 14, 11, coat);
  r(12, 7, 11, 7, "#deb79a");
  r(10, 4, 16, 5, "#a9b1af");
  r(15, 1, 6, 4, coat);
  r(15, 10, 2, 2, "#283139");
  r(21, 10, 2, 2, "#283139");
  r(10, 22, 14, 3, "#d3b57b");
  if (type === "shield") {
    r(4, 15, 7, 12, "#b2976b");
    r(6, 17, 3, 8, coat);
    r(26, 10, 2, 19, "#c6cfca");
  }
  if (type === "spear") {
    r(27, 3, 2, 27, "#876944");
    r(26, 0, 4, 7, "#e6e8d9");
  }
  if (type === "bow") {
    r(4, 12, 2, 16, "#9f7548");
    r(2, 15, 2, 9, "#9f7548");
    r(6, 16, 4, 2, "#e4cf9d");
  }
  if (type === "cavalry") {
    r(4, 23, 26, 6, "#795946");
    r(4, 21, 6, 5, "#a57d56");
    r(7, 28, 3, 4, "#3d3430");
    r(25, 28, 3, 4, "#3d3430");
    r(28, 7, 2, 22, "#d0c8a6");
  }
  const t = new T.CanvasTexture(c);
  t.magFilter = t.minFilter = T.NearestFilter;
  t.colorSpace = T.SRGBColorSpace;
  return t;
}
function label(text, color = "#f2e6c8") {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 56;
  const x = c.getContext("2d");
  x.fillStyle = "#15242ddd";
  x.fillRect(0, 0, 256, 56);
  x.fillStyle = color;
  x.textAlign = "center";
  x.font = "bold 28px sans-serif";
  x.fillText(text, 128, 38);
  const t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace;
  return t;
}
export class ArmyView {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = new T.Scene();
    this.scene.background = new T.Color("#202f36");
    this.camera = new T.OrthographicCamera(-22, 22, 22, -22, 0.1, 120);
    this.camera.position.set(0, 46, 35);
    this.camera.lookAt(0, 0, 0);
    this.renderer = new T.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.scene.add(new T.HemisphereLight("#e3d9b5", "#3c493c", 2.3));
    const sun = new T.DirectionalLight("#fff0cd", 2);
    sun.position.set(-10, 24, 12);
    this.scene.add(sun);
    this.groups = new Map();
    this.lines = new Map();
    this.textures = [];
    this.materials = {};
    this.fx = new Map();
    this.cells = [];
    this.ray = new T.Raycaster();
    this.plane = new T.Plane(new T.Vector3(0, 1, 0), 0);
    const mat = (color) =>
      new T.MeshStandardMaterial({ color, roughness: 1, flatShading: true });
    const floor = new T.Mesh(new T.PlaneGeometry(42, 44), mat("#646e56"));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.05;
    this.scene.add(floor);
    const road = new T.Mesh(new T.PlaneGeometry(7, 43), mat("#999071"));
    road.rotation.x = -Math.PI / 2;
    road.position.y = -0.025;
    this.scene.add(road);
    const edges = new T.GridHelper(40, 10, "#b3af89", "#7e8768");
    edges.position.y = 0.005;
    this.scene.add(edges);
    const wood = mat("#6b5844");
    for (const side of [-1, 1])
      for (let i = 0; i < 12; i++) {
        const post = new T.Mesh(new T.ConeGeometry(0.18, 1.7, 4), wood);
        post.position.set(side * 19, 0.7, (i - 5.5) * 3.4);
        this.scene.add(post);
      }
    for (const [side, z] of [
      ["ally", 18],
      ["enemy", -18],
    ]) {
      const base = new T.Mesh(
        new T.BoxGeometry(7, 1.4, 2.5),
        mat(side === "ally" ? "#4b7c83" : "#9b5c50"),
      );
      base.position.set(0, 0.7, z);
      this.scene.add(base);
      const name = new T.Sprite(
        new T.SpriteMaterial({
          map: label(side === "ally" ? "我军大营" : "敌军大营"),
          depthWrite: false,
        }),
      );
      this.textures.push(name.material.map);
      name.position.set(0, 2.9, z);
      name.scale.set(5, 1.1, 1);
      this.scene.add(name);
    }
    for (let row = 0; row < 3; row++)
      for (let col = 0; col < 7; col++) {
        const p = cellPosition(col, row);
        const cell = new T.Mesh(
          new T.PlaneGeometry(3.75, 3.2),
          new T.MeshBasicMaterial({
            color: row === 0 ? "#7fb7ad" : "#89a9bd",
            transparent: true,
            opacity: 0.16,
            side: T.DoubleSide,
            depthWrite: false,
          }),
        );
        cell.rotation.x = -Math.PI / 2;
        cell.position.set(p.x, 0.03, p.z);
        this.scene.add(cell);
        this.cells.push(cell);
      }
    this.flag = new T.Group();
    const pole = new T.Mesh(new T.CylinderGeometry(0.07, 0.07, 3.5, 5), wood);
    pole.position.y = 1.7;
    this.flag.add(pole);
    this.banner = new T.Mesh(
      new T.PlaneGeometry(1.3, 0.9),
      new T.MeshBasicMaterial({ color: "#d4b772", side: T.DoubleSide }),
    );
    this.banner.position.set(0.65, 2.7, 0);
    this.flag.add(this.banner);
    this.scene.add(this.flag);
    this.flagRing = new T.Mesh(
      new T.RingGeometry(3.7, 3.85, 48),
      new T.MeshBasicMaterial({
        color: "#d3b474",
        transparent: true,
        opacity: 0.7,
        side: T.DoubleSide,
      }),
    );
    this.flagRing.rotation.x = -Math.PI / 2;
    this.flagRing.position.y = 0.06;
    this.scene.add(this.flagRing);
    this.destination = new T.Mesh(
      new T.RingGeometry(0.5, 0.75, 24),
      new T.MeshBasicMaterial({ color: "#e5d59e", side: T.DoubleSide }),
    );
    this.destination.rotation.x = -Math.PI / 2;
    this.scene.add(this.destination);
    for (const type of Object.keys(TYPES))
      for (const side of ["ally", "enemy"]) {
        const tex = pixel(type, side === "enemy");
        this.textures.push(tex);
        this.materials[side + type] = new T.SpriteMaterial({
          map: tex,
          transparent: true,
          depthWrite: false,
        });
      }
    this.arrowGeo = new T.BoxGeometry(0.09, 0.09, 0.65);
    this.arrowMat = new T.MeshBasicMaterial({ color: "#f2d290" });
    this.hitGeo = new T.RingGeometry(0.35, 0.5, 12);
    this.fireGeo = new T.CircleGeometry(4, 40);
    this.resize = () => {
      const width = canvas.clientWidth,
        height = canvas.clientHeight;
      if (!width || !height) return;
      this.renderer.setSize(width, height, false);
      const aspect = width / height;
      const halfH = Math.max(24, 21 / aspect);
      this.camera.left = -halfH * aspect;
      this.camera.right = halfH * aspect;
      this.camera.top = halfH;
      this.camera.bottom = -halfH;
      this.camera.updateProjectionMatrix();
    };
    this.observer = new ResizeObserver(this.resize);
    this.observer.observe(canvas);
    this.resize();
  }
  point(clientX, clientY) {
    const r = this.canvas.getBoundingClientRect();
    this.ray.setFromCamera(
      new T.Vector2(
        ((clientX - r.left) / r.width) * 2 - 1,
        (-(clientY - r.top) / r.height) * 2 + 1,
      ),
      this.camera,
    );
    const p = new T.Vector3();
    return this.ray.ray.intersectPlane(this.plane, p)
      ? { x: p.x, z: p.z }
      : null;
  }
  squad(s) {
    const group = new T.Group();
    const sprites = [];
    for (let i = 0; i < 8; i++) {
      const sprite = new T.Sprite(this.materials[s.side + s.type]);
      sprite.center.set(0.5, 0.05);
      sprite.scale.setScalar(s.type === "cavalry" ? 1.4 : 1.15);
      group.add(sprite);
      sprites.push(sprite);
    }
    const tag = new T.Sprite(
      new T.SpriteMaterial({
        map: label(s.name, s.side === "ally" ? "#c5eee4" : "#f6c6b8"),
        depthWrite: false,
      }),
    );
    this.textures.push(tag.material.map);
    tag.scale.set(3.2, 0.7, 1);
    tag.position.y = 2.7;
    group.add(tag);
    const hp = new T.Mesh(
      new T.PlaneGeometry(2.6, 0.12),
      new T.MeshBasicMaterial({
        color: s.side === "ally" ? "#94d3bc" : "#e7947b",
        side: T.DoubleSide,
      }),
    );
    hp.rotation.x = -Math.PI / 2;
    hp.position.set(0, 0.08, 1.5);
    group.add(hp);
    const ring = new T.Mesh(
      new T.RingGeometry(1.8, 1.9, 32),
      new T.MeshBasicMaterial({
        color: "#ead28d",
        side: T.DoubleSide,
        transparent: true,
        opacity: 0.9,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.06;
    group.add(ring);
    this.scene.add(group);
    return { group, sprites, hp, ring, tag };
  }
  sync(w) {
    const plan = ["draft", "plan", "reward"].includes(w.phase);
    for (const c of this.cells) c.visible = plan;
    this.banner.material.color.set(w.flag.captured ? "#84d2b9" : "#d4b772");
    this.flagRing.material.color.copy(this.banner.material.color);
    const seen = new Set();
    for (const s of [...w.allies, ...w.enemies]) {
      seen.add(s.id);
      let g = this.groups.get(s.id);
      if (!g) {
        g = this.squad(s);
        this.groups.set(s.id, g);
      }
      g.group.visible = s.hp > 0 || plan;
      if (!g.group.visible) continue;
      g.group.position.set(s.x, 0, s.z);
      g.ring.visible =
        s.side === "ally" && (w.selected === s.id || w.selected === null);
      g.hp.scale.x = Math.max(0.01, s.hp / s.maxHp);
      g.hp.material.color.set(
        s.flash > 0 ? "#fff2d5" : s.side === "ally" ? "#94d3bc" : "#e7947b",
      );
      const n = plan ? 8 : soldierCount(s);
      for (let i = 0; i < 8; i++) {
        const sprite = g.sprites[i];
        sprite.visible = i < n;
        const row = Math.floor(i / 4),
          col = i % 4;
        let x = (col - 1.5) * 0.72,
          z = row * 0.75;
        if (s.formation === "wedge") {
          const r = Math.floor(Math.sqrt(i));
          x = (i - r * r - r) * 0.72;
          z = r * 0.75;
        }
        sprite.position.set(x, Math.sin(w.totalTime * 8 + i) * 0.025, z);
      }
    }
    for (const [id, g] of this.groups)
      if (!seen.has(id)) {
        this.scene.remove(g.group);
        g.tag.material.map.dispose();
        g.tag.material.dispose();
        g.hp.material.dispose();
        g.hp.geometry.dispose();
        g.ring.geometry.dispose();
        g.ring.material.dispose();
        this.groups.delete(id);
      }
    const selected = w.allies.find((a) => a.id === w.selected);
    this.destination.visible =
      !!selected?.target && ["battle", "tactics"].includes(w.phase);
    if (selected?.target)
      this.destination.position.set(selected.target.x, 0.08, selected.target.z);
    // Show the exact deployment adjacency used by the synergy rules.
    for (const l of this.lines.values()) {
      this.scene.remove(l);
      l.geometry.dispose();
      l.material.dispose();
    }
    this.lines.clear();
    if (plan)
      for (const link of w.links()) {
        const a = w.allies.find((s) => s.id === link.a),
          b = w.allies.find((s) => s.id === link.b);
        const line = new T.Line(
          new T.BufferGeometry().setFromPoints([
            new T.Vector3(a.x, 0.12, a.z),
            new T.Vector3(b.x, 0.12, b.z),
          ]),
          new T.LineBasicMaterial({
            color: link.kind === "shield" ? "#7be4da" : "#edcf83",
          }),
        );
        this.scene.add(line);
        this.lines.set(`${link.a}-${link.b}`, line);
      }
    const ids = new Set();
    for (const e of [...w.shots, ...w.effects]) {
      ids.add(e.id);
      let m = this.fx.get(e.id);
      if (!m) {
        m = new T.Mesh(
          e.kind === "fire"
            ? this.fireGeo
            : e.ranged
              ? this.arrowGeo
              : this.hitGeo,
          new T.MeshBasicMaterial({
            color:
              e.kind === "fire"
                ? "#ee9a51"
                : e.side === "ally"
                  ? "#b6e9e0"
                  : "#f1b18a",
            transparent: true,
            opacity: 0.75,
            side: T.DoubleSide,
            depthWrite: false,
          }),
        );
        if (!e.ranged) m.rotation.x = -Math.PI / 2;
        this.scene.add(m);
        this.fx.set(e.id, m);
      }
      m.material.opacity = (0.75 * e.life) / e.maxLife;
      if (e.kind === "fire") m.position.set(e.x, 0.13, e.z);
      else {
        const t = 1 - e.life / e.maxLife;
        m.position.set(
          e.from.x + (e.to.x - e.from.x) * t,
          e.ranged ? 1 : 0.1,
          e.from.z + (e.to.z - e.from.z) * t,
        );
        if (e.ranged)
          m.rotation.y = Math.atan2(e.to.x - e.from.x, e.to.z - e.from.z);
      }
    }
    for (const [id, m] of this.fx)
      if (!ids.has(id)) {
        this.scene.remove(m);
        m.material.dispose();
        this.fx.delete(id);
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
    for (const m of Object.values(this.materials)) ms.add(m);
    gs.forEach((g) => g.dispose());
    ms.forEach((m) => m.dispose());
    this.textures.forEach((t) => t.dispose());
    this.renderer.dispose();
  }
}
