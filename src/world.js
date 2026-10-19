import { clamp, direction, distance, rng, nearest } from "./math.js";
export const cards = [
  {
    id: "power",
    name: "龙胆·锋芒",
    tag: "枪术",
    description: (w) => `长枪伤害 ${w.damage} → ${w.damage + 1}`,
    apply: (w) => w.damage++,
  },
  {
    id: "reach",
    name: "一寸长，一寸强",
    tag: "枪术",
    description: (w) =>
      `长枪距离 ${w.reach.toFixed(1)} → ${(w.reach + 0.65).toFixed(1)}`,
    apply: (w) => (w.reach += 0.65),
  },
  {
    id: "haste",
    name: "疾风骤雨",
    tag: "军略",
    description: (w) =>
      `攻击间隔 ${w.interval.toFixed(2)} → ${Math.max(0.22, w.interval * 0.85).toFixed(2)} 秒`,
    apply: (w) => (w.interval = Math.max(0.22, w.interval * 0.85)),
  },
  {
    id: "echo",
    name: "龙影随行",
    tag: "身法",
    description: (w) => `闪避路径伤害 ${w.echo} → ${w.echo + 2} · 穿阵时触发`,
    apply: (w) => (w.echo += 2),
  },
  {
    id: "magnet",
    name: "聚势",
    tag: "军略",
    description: (w) =>
      `战意拾取范围 ${w.pickup.toFixed(1)} → ${(w.pickup + 1).toFixed(1)}`,
    apply: (w) => w.pickup++,
  },
  {
    id: "heal",
    name: "整军再战",
    tag: "补给",
    description: (w) =>
      `恢复 35 生命 · 上限 ${w.player.maxHp} → ${w.player.maxHp + 10}`,
    apply: (w) => {
      w.player.maxHp += 10;
      w.player.hp = Math.min(w.player.maxHp, w.player.hp + 35);
    },
  },
];
export class World {
  constructor({ seed = 731, duration = 180, bossAt = 150 } = {}) {
    this.options = { seed, duration, bossAt };
    this.reset();
  }
  reset() {
    this.random = rng(this.options.seed);
    this.phase = "ready";
    this.time = 0;
    this.serial = 0;
    this.kills = 0;
    this.level = 1;
    this.xp = 0;
    this.xpNext = 5;
    this.damage = 3;
    this.reach = 4.4;
    this.interval = 0.72;
    this.echo = 2;
    this.pickup = 2.4;
    this.fire = 0;
    this.spawnClock = 0;
    this.charge = 0;
    this.breakthrough = false;
    this.player = {
      x: 0,
      z: 6,
      hp: 100,
      maxHp: 100,
      invul: 0,
      fx: 0,
      fz: -1,
      stamina: 2,
      dash: 0,
    };
    this.flag = { x: 0, z: -5, progress: 0, captured: false };
    this.ally = null;
    this.enemies = [];
    this.shots = [];
    this.gems = [];
    this.effects = [];
    this.events = [];
    this.choices = [];
    this.bossSpawned = false;
    this.bossDefeated = false;
    this.endReason = "";
    this.stats = { spear: 0, echo: 0, ally: 0, musou: 0 };
  }
  start() {
    if (this.phase === "ready") this.phase = "play";
  }
  pause() {
    if (this.phase === "play") this.phase = "paused";
    else if (this.phase === "paused") this.phase = "play";
  }
  effect(kind, x, z, extra = {}) {
    this.effects.push({
      id: ++this.serial,
      kind,
      x,
      z,
      life: 0.28,
      maxLife: 0.28,
      ...extra,
    });
  }
  spawn(boss = false) {
    let a = this.random() * Math.PI * 2;
    let type = boss
      ? "boss"
      : this.time > 45 && this.random() < 0.25
        ? "archer"
        : this.time > 25 && this.random() < 0.3
          ? "charger"
          : "soldier";
    const r = 14;
    this.enemies.push({
      id: ++this.serial,
      type,
      x: clamp(this.player.x + Math.cos(a) * r, -23, 23),
      z: clamp(this.player.z + Math.sin(a) * r, -23, 23),
      hp: boss ? 240 : type === "charger" ? 7 : 5,
      maxHp: boss ? 240 : type === "charger" ? 7 : 5,
      radius: boss ? 1 : 0.43,
      speed: boss ? 1.7 : type === "charger" ? 2.9 : 1.65,
      clock: boss ? 2 : 2 + this.random() * 2,
      wind: 0,
    });
  }
  hit(e, amount, source) {
    if (e.hp <= 0) return;
    e.hp -= amount;
    e.flash = 0.12;
    this.stats[source] += amount;
    this.charge = clamp(this.charge + amount * 0.34, 0, 100);
  }
  dash() {
    const p = this.player;
    if (this.phase !== "play" || p.stamina < 1 || p.dash > 0) return false;
    p.stamina--;
    p.dash = 0.22;
    p.invul = Math.max(p.invul, 0.3);
    p.dx = p.fx;
    p.dz = p.fz;
    this.dashHits = new Set();
    return true;
  }
  musou() {
    if (this.phase !== "play" || this.charge < 100) return false;
    this.charge = 0;
    this.player.invul = 1;
    this.effect("musou", this.player.x, this.player.z, {
      life: 0.8,
      maxLife: 0.8,
    });
    for (const e of this.enemies)
      if (distance(e, this.player) < 8) this.hit(e, 25, "musou");
    return true;
  }
  choose(id) {
    if (this.phase !== "upgrade" || !this.choices.includes(id)) return false;
    cards.find((c) => c.id === id).apply(this);
    this.phase = "play";
    this.choices = [];
    return true;
  }
  update(dt, input = { x: 0, z: 0, interact: false }) {
    if (this.phase !== "play") return;
    dt = clamp(dt, 0, 0.05);
    this.time += dt;
    const p = this.player;
    const v = direction(input.x, input.z);
    p.invul = Math.max(0, p.invul - dt);
    p.stamina = Math.min(2, p.stamina + dt / 2.6);
    if (p.dash > 0) {
      p.dash = Math.max(0, p.dash - dt);
      p.x = clamp(p.x + p.dx * 22 * dt, -21, 21);
      p.z = clamp(p.z + p.dz * 22 * dt, -21, 21);
      this.effect("echo", p.x, p.z, { life: 0.3, maxLife: 0.3 });
      for (const e of this.enemies)
        if (distance(p, e) < 1.8 && !this.dashHits.has(e.id)) {
          this.hit(e, this.echo, "echo");
          this.dashHits.add(e.id);
        }
    } else {
      if (v.x || v.z) {
        p.fx = v.x;
        p.fz = v.z;
      }
      p.x = clamp(p.x + v.x * 5 * dt, -21, 21);
      p.z = clamp(p.z + v.z * 5 * dt, -21, 21);
    }
    this.spawnClock += dt * (1.2 + Math.min(this.time / 35, 3));
    while (this.spawnClock >= 1) {
      this.spawnClock--;
      if (this.enemies.length < 90) this.spawn();
    }
    if (this.time >= this.options.bossAt && !this.bossSpawned) {
      this.spawn(true);
      this.bossSpawned = true;
      this.events.push("boss");
    }
    this.fire -= dt;
    if (this.fire <= 0) {
      const target = nearest(p, this.enemies);
      if (target && distance(target, p) < this.reach + 1) {
        // Slight auto-aim makes the prototype readable on touch and keyboard alike.
        const d = direction(target.x - p.x, target.z - p.z);
        this.fire = this.interval;
        this.effect("spear", p.x, p.z, {
          dx: d.x,
          dz: d.z,
          length: this.reach,
        });
        for (const e of this.enemies) {
          const x = e.x - p.x,
            z = e.z - p.z,
            along = x * d.x + z * d.z,
            across = Math.abs(x * d.z - z * d.x);
          if (
            along > -0.35 &&
            along < this.reach + e.radius &&
            across < 0.65 + e.radius
          )
            this.hit(e, this.damage, "spear");
        }
      }
    }
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      e.flash = Math.max(0, (e.flash || 0) - dt);
      e.clock -= dt;
      const d = direction(p.x - e.x, p.z - e.z),
        dist = distance(p, e);
      if (e.type === "boss") {
        if (e.wind > 0) {
          e.wind -= dt;
          if (e.wind <= 0) {
            this.effect("impact", e.tx, e.tz, { life: 0.5, maxLife: 0.5 });
            if (Math.hypot(p.x - e.tx, p.z - e.tz) < 3 && p.invul <= 0) {
              p.hp -= 24;
              p.invul = 0.8;
              this.endReason = "敌将重击";
            }
          }
        } else {
          if (dist > 2) {
            e.x += d.x * e.speed * dt;
            e.z += d.z * e.speed * dt;
          }
          if (e.clock <= 0) {
            e.clock = 3.4;
            e.wind = 1.1;
            e.tx = p.x;
            e.tz = p.z;
          }
        }
      } else if (e.type === "archer" && dist < 9) {
        if (e.clock <= 0) {
          e.clock = 2.8;
          this.shots.push({
            id: ++this.serial,
            x: e.x,
            z: e.z,
            vx: d.x * 6,
            vz: d.z * 6,
            life: 3,
            hostile: true,
            damage: 8,
          });
        }
      } else {
        e.x += d.x * e.speed * dt;
        e.z += d.z * e.speed * dt;
      }
      if (dist < e.radius + 0.45 && p.invul <= 0) {
        p.hp -= e.type === "boss" ? 18 : 8;
        p.invul = 0.75;
        this.endReason =
          e.type === "archer"
            ? "弓手近身"
            : e.type === "charger"
              ? "突击兵冲撞"
              : "敌军包围";
      }
    }
    const f = this.flag;
    if (!f.captured && distance(f, p) < 3 && input.interact) {
      f.progress = Math.min(10, f.progress + dt);
      if (f.progress >= 10) {
        f.captured = true;
        this.xp += 12;
        this.ally = { x: p.x - 1.5, z: p.z + 1.5, fire: 0 };
        p.hp = Math.min(p.maxHp, p.hp + 25);
        this.events.push("flag");
      }
    }
    if (this.ally) {
      const a = this.ally,
        tx = p.x - 1.5,
        tz = p.z + 1.5;
      a.x += (tx - a.x) * Math.min(1, dt * 7);
      a.z += (tz - a.z) * Math.min(1, dt * 7);
      a.fire -= dt;
      const target = nearest(a, this.enemies);
      if (a.fire <= 0 && target && distance(a, target) < 12) {
        const d = direction(target.x - a.x, target.z - a.z);
        a.fire = 0.8;
        this.shots.push({
          id: ++this.serial,
          x: a.x,
          z: a.z,
          vx: d.x * 16,
          vz: d.z * 16,
          life: 1,
          hostile: false,
          damage: 3,
        });
      }
    }
    for (const s of this.shots) {
      const old = { x: s.x, z: s.z };
      s.x += s.vx * dt;
      s.z += s.vz * dt;
      s.life -= dt;
      const targets = s.hostile ? [p] : this.enemies;
      for (const e of targets) {
        if (!s.hostile && e.hp <= 0) continue;
        const dx = s.x - old.x,
          dz = s.z - old.z,
          len = dx * dx + dz * dz,
          t = len
            ? clamp(((e.x - old.x) * dx + (e.z - old.z) * dz) / len, 0, 1)
            : 0;
        if (
          Math.hypot(e.x - old.x - dx * t, e.z - old.z - dz * t) <
          (e.radius || 0.45) + 0.18
        ) {
          if (s.hostile) {
            if (p.invul <= 0) {
              p.hp -= s.damage;
              p.invul = 0.65;
              this.endReason = "敌军弩矢";
            }
          } else this.hit(e, s.damage, "ally");
          s.life = 0;
          break;
        }
      }
    }
    for (const e of this.enemies)
      if (e.hp <= 0) {
        this.kills++;
        this.gems.push({
          id: ++this.serial,
          x: e.x,
          z: e.z,
          value: e.type === "boss" ? 15 : 1,
        });
        if (e.type === "boss") this.bossDefeated = true;
      }
    this.enemies = this.enemies.filter((e) => e.hp > 0);
    this.shots = this.shots.filter((s) => s.life > 0);
    for (const g of this.gems) {
      const d = distance(g, p);
      if (d < this.pickup) {
        const n = direction(p.x - g.x, p.z - g.z);
        g.x += n.x * 12 * dt;
        g.z += n.z * 12 * dt;
      }
      if (d < 0.65) {
        this.xp += g.value;
        g.collected = true;
      }
    }
    this.gems = this.gems.filter((g) => !g.collected).slice(-350);
    for (const e of this.effects) e.life -= dt;
    this.effects = this.effects.filter((e) => e.life > 0).slice(-80);
    if (this.xp >= this.xpNext) {
      this.xp -= this.xpNext;
      this.level++;
      this.xpNext += 3;
      this.phase = "upgrade";
      const pool = cards.map((c) => c.id);
      this.choices = [];
      while (this.choices.length < 3)
        this.choices.push(
          pool.splice(Math.floor(this.random() * pool.length), 1)[0],
        );
    }
    if (this.level >= 4 && f.captured && !this.breakthrough) {
      this.breakthrough = true;
      this.damage += 2;
      this.reach += 1;
      p.hp = Math.min(p.maxHp, p.hp + 20);
      this.events.push("breakthrough");
    }
    if (p.hp <= 0) {
      p.hp = 0;
      this.phase = "over";
    } else if (this.time >= this.options.duration && this.bossDefeated) {
      this.phase = "won";
    } else if (this.time >= this.options.duration + 60) {
      this.phase = "over";
      this.endReason = "决战超时，敌军增援抵达";
    }
  }
}
