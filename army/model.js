import { clamp, direction, distance, rng } from "../src/math.js";
export const TYPES = {
  shield: {
    name: "刀盾",
    hp: 180,
    damage: 11,
    range: 2.3,
    speed: 2.1,
    interval: 1.1,
    color: "#75b6b8",
    role: "承伤 · 掩护邻近弓队",
  },
  spear: {
    name: "长枪",
    hp: 140,
    damage: 14,
    range: 3,
    speed: 2.2,
    interval: 1.15,
    color: "#a5c48b",
    role: "克骑 · 坚守时抗冲锋",
  },
  bow: {
    name: "弓弩",
    hp: 100,
    damage: 13,
    range: 10,
    speed: 2,
    interval: 1.35,
    color: "#d8bc77",
    role: "远射 · 克制长枪",
  },
  cavalry: {
    name: "骑兵",
    hp: 150,
    damage: 16,
    range: 2.2,
    speed: 3.6,
    interval: 1.2,
    color: "#c3a4d9",
    role: "突击 · 克弓 · 绕后",
  },
};
export const GENERALS = [
  {
    id: "liubei",
    name: "刘备",
    type: "shield",
    skill: "仁德",
    detail: "相邻友军每秒恢复 1.5 兵力（战前相邻，战中需靠近）",
  },
  {
    id: "guanyu",
    name: "关羽",
    type: "spear",
    skill: "青龙",
    detail: "枪队基础伤害提高 20%",
  },
  {
    id: "huangzhong",
    name: "黄忠",
    type: "bow",
    skill: "百步",
    detail: "射程额外 +2",
  },
  {
    id: "zhaoyun",
    name: "赵云",
    type: "cavalry",
    skill: "龙胆",
    detail: "行军积攒冲锋，首次接敌造成强化一击",
  },
  {
    id: "zhangfei",
    name: "张飞",
    type: "spear",
    skill: "断喝",
    detail: "接敌时降低周围敌军攻击 20%",
  },
  {
    id: "zhouyu",
    name: "周瑜",
    type: "bow",
    skill: "火攻",
    detail: "弓矢附加燃烧，持续 3 秒",
  },
  {
    id: "caocao",
    name: "曹操",
    type: "shield",
    skill: "号令",
    detail: "附近友军攻击间隔缩短 10%",
  },
  {
    id: "sunshangxiang",
    name: "孙尚香",
    type: "cavalry",
    skill: "轻骑",
    detail: "轻骑行军速度提高 15%",
  },
];
export const FORMATIONS = {
  line: { name: "横阵", detail: "展开四列，覆盖更宽" },
  wedge: { name: "锋矢", detail: "尖锋推进，便于集中突击" },
};
export const counter = (a, b) =>
  ({ cavalry: "bow", bow: "spear", spear: "cavalry" })[a] === b ? 1.45 : 1;
export const soldierCount = (s) =>
  s.hp <= 0 ? 0 : Math.ceil((s.hp / s.maxHp) * 8);
export const cellPosition = (col, row) => ({
  x: (col - 3) * 4,
  z: 7 + row * 3.5,
});
export const adjacent = (a, b) =>
  Math.abs(a.col - b.col) + Math.abs(a.row - b.row) === 1;
const validCell = (col, row) =>
  Number.isInteger(col) &&
  Number.isInteger(row) &&
  col >= 0 &&
  col < 7 &&
  row >= 0 &&
  row < 3;
const general = (id) => GENERALS.find((g) => g.id === id);
export class ArmyWorld {
  constructor({ seed = 731 } = {}) {
    this.seed = seed;
    this.reset();
  }
  reset() {
    this.random = rng(this.seed);
    this.serial = 0;
    this.phase = "draft";
    this.round = 1;
    this.time = 0;
    this.totalTime = 0;
    this.command = 80;
    this.selected = null;
    this.targetMode = "move";
    this.formation = "line";
    this.allies = [];
    this.enemies = [];
    this.shots = [];
    this.effects = [];
    this.log = [];
    this.damageBonus = 1;
    this.fireBonus = 1;
    this.skillCooldown = 0;
    this.speedBuff = 0;
    this.result = "";
    this.casualties = 0;
    this.captured = 0;
    this.stats = { orders: 0, fire: 0, flanks: 0, counters: 0 };
    this.headquarters = { ally: 280, enemy: 280 };
    this.flag = { x: 0, z: 0, progress: 0, captured: false };
    this.addGeneral("liubei", 2, 0);
    this.addGeneral("guanyu", 3, 0);
    this.addGeneral("huangzhong", 2, 1);
    this.offer = this.draftOffer();
    this.prepareEnemy();
    this.note("先选一名武将，让你的军势成形。");
  }
  note(text) {
    this.log.unshift(text);
    this.log = this.log.slice(0, 5);
  }
  addGeneral(id, col, row) {
    if (this.allies.length >= 6 || this.allies.some((s) => s.general === id))
      return false;
    const g = general(id);
    if (!g) return false;
    if (col === undefined) {
      const used = new Set(this.allies.map((s) => `${s.col},${s.row}`));
      for (const [c, r] of [
        [4, 0],
        [3, 1],
        [4, 1],
        [1, 0],
        [5, 1],
        [3, 2],
      ])
        if (!used.has(`${c},${r}`)) {
          col = c;
          row = r;
          break;
        }
    }
    const s = this.makeSquad(g.type, "ally", cellPosition(col, row), g.id);
    s.col = col;
    s.row = row;
    s.name = g.name;
    s.hp = s.maxHp;
    s.formation = this.formation;
    this.allies.push(s);
    return s;
  }
  makeSquad(type, side, pos, id = null) {
    const t = TYPES[type],
      g = id && general(id);
    return {
      id: ++this.serial,
      general: id,
      name: g?.name ?? `${t.name}营`,
      type,
      side,
      ...pos,
      hp: t.hp,
      maxHp: t.hp,
      damage: t.damage * (id === "guanyu" ? 1.2 : 1),
      range: t.range + (id === "huangzhong" ? 2 : 0),
      speed: t.speed * (id === "sunshangxiang" ? 1.15 : 1),
      interval: t.interval,
      clock: this.random() * 0.6,
      charge: 0,
      stance: "advance",
      target: null,
      fx: 0,
      fz: side === "ally" ? -1 : 1,
      burning: 0,
      formation: "line",
      damageDone: 0,
    };
  }
  draftOffer() {
    const owned = new Set(this.allies.map((s) => s.general));
    const pool = GENERALS.filter((g) => !owned.has(g.id));
    const picks = [];
    while (pool.length && picks.length < 3)
      picks.push({
        kind: "recruit",
        general: pool.splice(Math.floor(this.random() * pool.length), 1)[0].id,
      });
    return picks;
  }
  choose(index) {
    if (
      !["draft", "reward"].includes(this.phase) ||
      !Number.isInteger(index) ||
      !this.offer[index]
    )
      return false;
    const c = this.offer[index];
    if (c.kind === "recruit") {
      if (!this.addGeneral(c.general)) return false;
      this.note(`${general(c.general).name}率部来援。`);
    } else if (c.kind === "heal") {
      for (const a of this.allies)
        a.hp = Math.min(a.maxHp, a.hp + a.maxHp * 0.5);
      this.note("粮秣送达，全军整补。");
    } else if (c.kind === "power") {
      this.damageBonus += 0.18;
      this.note("精练武备：全军伤害 +18%。");
    } else if (c.kind === "fire") {
      this.fireBonus += 0.4;
      this.note("火计伤害提高，等待你的下一次布令。");
    }
    this.offer = [];
    this.phase = "plan";
    return true;
  }
  place(id, col, row) {
    if (this.phase !== "plan" || !validCell(col, row)) return false;
    const s = this.allies.find((a) => a.id === id);
    if (!s) return false;
    const other = this.allies.find((a) => a.col === col && a.row === row);
    if (other && other !== s) {
      other.col = s.col;
      other.row = s.row;
      Object.assign(other, cellPosition(other.col, other.row));
    }
    s.col = col;
    s.row = row;
    Object.assign(s, cellPosition(col, row));
    return true;
  }
  setFormation(id) {
    if (!FORMATIONS[id] || !["plan", "battle", "tactics"].includes(this.phase))
      return false;
    this.formation = id;
    for (const a of this.allies)
      if (this.selected === null || a.id === this.selected) a.formation = id;
    return true;
  }
  prepareEnemy() {
    const layouts = [
      [
        ["shield", -6, -8],
        ["spear", 0, -8],
        ["bow", -6, -13],
        ["cavalry", 8, -11],
      ],
      [
        ["shield", -5, -8],
        ["shield", 0, -8],
        ["spear", 5, -8],
        ["bow", -5, -14],
        ["bow", 5, -14],
      ],
      [
        ["spear", -6, -8],
        ["spear", 0, -8],
        ["cavalry", 8, -10],
        ["bow", -7, -14],
        ["bow", 0, -14],
        ["shield", 5, -13],
      ],
    ];
    this.enemies = layouts[this.round - 1].map(([type, x, z]) => {
      const s = this.makeSquad(type, "enemy", { x, z });
      const scale = 1 + (this.round - 1) * 0.12;
      s.hp = s.maxHp = Math.round(s.hp * scale);
      s.damage *= 1 + (this.round - 1) * 0.08;
      return s;
    });
  }
  links() {
    const links = [];
    for (const a of this.allies)
      for (const b of this.allies)
        if (a.id < b.id && adjacent(a, b)) {
          if (
            [a.type, b.type].includes("shield") &&
            [a.type, b.type].includes("bow")
          )
            links.push({ a: a.id, b: b.id, kind: "shield", name: "盾弓协防" });
          if (
            ["liubei", "guanyu", "zhangfei"].includes(a.general) &&
            ["liubei", "guanyu", "zhangfei"].includes(b.general)
          )
            links.push({ a: a.id, b: b.id, kind: "oath", name: "同袍相援" });
        }
    return links;
  }
  begin() {
    if (this.phase !== "plan") return false;
    this.time = 0;
    this.command = 80;
    this.headquarters = { ally: 280, enemy: 280 };
    this.flag = { x: 0, z: 0, progress: 0, captured: false };
    this.skillCooldown = 0;
    this.speedBuff = 0;
    this.shots = [];
    this.effects = [];
    this.activeLinks = this.links();
    for (const a of this.allies) {
      Object.assign(a, cellPosition(a.col, a.row));
      a.stance = "advance";
      a.target = null;
      a.clock = 0;
      a.charge = 0;
      a.burning = 0;
      a.fz = -1;
      a.fx = 0;
    }
    this.phase = "battle";
    this.note("全军出阵！点击部队卡，再点战场下达行军命令。");
    return true;
  }
  pause() {
    if (this.phase === "battle") this.phase = "tactics";
    else if (this.phase === "tactics") this.phase = "battle";
  }
  select(id) {
    if (id !== null && !this.allies.some((a) => a.id === id)) return false;
    this.selected = id;
    return true;
  }
  recipients() {
    return this.allies.filter(
      (a) => a.hp > 0 && (this.selected === null || a.id === this.selected),
    );
  }
  order(stance, point = null) {
    if (
      !["battle", "tactics"].includes(this.phase) ||
      !["advance", "hold", "retreat"].includes(stance)
    )
      return false;
    const recipients = this.recipients();
    if (
      !recipients.length ||
      (point && (!Number.isFinite(point.x) || !Number.isFinite(point.z)))
    )
      return false;
    for (const [i, a] of recipients.entries()) {
      a.stance = stance;
      a.target = point
        ? {
            x: clamp(
              point.x + (this.selected === null ? ((i % 3) - 1) * 3 : 0),
              -15,
              15,
            ),
            z: clamp(
              point.z + (this.selected === null ? Math.floor(i / 3) * 2.5 : 0),
              -16,
              16,
            ),
          }
        : stance === "retreat"
          ? { x: a.x, z: 13 }
          : null;
    }
    this.stats.orders++;
    this.note(
      `${this.selected === null ? "全军" : (this.recipients()[0]?.name ?? "部队")}：${{ advance: "推进", hold: "坚守", retreat: "回撤" }[stance]}${point ? "至指定位置" : ""}`,
    );
    return true;
  }
  tactic(type, point = null) {
    if (type === "heal" && !this.recipients().length) return false;
    if (!["battle", "tactics"].includes(this.phase) || this.skillCooldown > 0)
      return false;
    const cost = { fire: 40, heal: 35, speed: 25 }[type];
    if (
      !cost ||
      this.command < cost ||
      (type === "fire" &&
        (!point || !Number.isFinite(point.x) || !Number.isFinite(point.z)))
    )
      return false;
    this.command -= cost;
    this.skillCooldown = 3;
    if (type === "fire") {
      const p = { x: clamp(point.x, -18, 18), z: clamp(point.z, -18, 18) };
      for (const e of this.enemies)
        if (e.hp > 0 && distance(e, p) < 4) {
          this.hurt(e, 32 * this.fireBonus);
          e.burning = 3;
        }
      this.effects.push({
        id: ++this.serial,
        kind: "fire",
        ...p,
        life: 1.2,
        maxLife: 1.2,
      });
      this.stats.fire++;
      this.note("火计已下！敌军聚集处燃起烈焰。");
    }
    if (type === "heal") {
      for (const a of this.recipients()) a.hp = Math.min(a.maxHp, a.hp + 35);
      this.note("整军：选中部队恢复 35 兵力；全军选中时作用于全军。");
    }
    if (type === "speed") {
      this.speedBuff = 6;
      this.note("疾行军：全军行军速度 +50%，持续 6 秒。");
    }
    return true;
  }
  hurt(s, amount) {
    if (s.hp <= 0) return 0;
    const actual = Math.min(s.hp, amount);
    s.hp -= actual;
    s.flash = 0.15;
    if (s.hp <= 0) this.casualties++;
    return actual;
  }
  attack(a, b) {
    let amount =
      a.damage *
      Math.pow(soldierCount(a) / 8, 0.6) *
      (a.side === "ally" ? this.damageBonus : 1) *
      counter(a.type, b.type);
    if (counter(a.type, b.type) > 1 && a.side === "ally") this.stats.counters++;
    const toward = direction(a.x - b.x, a.z - b.z);
    if (toward.x * b.fx + toward.z * b.fz < -0.35) {
      amount *= 1.35;
      if (a.side === "ally") this.stats.flanks++;
    }
    if (a.type === "cavalry" && a.charge >= 3) {
      amount *= a.general === "zhaoyun" ? 2.4 : 1.8;
      a.charge = 0;
    }
    if (b.type === "spear" && b.stance === "hold" && a.type === "cavalry")
      amount *= 0.6;
    if (
      a.type === "bow" &&
      b.type === "bow" &&
      this.activeLinks?.some(
        (l) =>
          l.kind === "shield" &&
          (l.a === b.id || l.b === b.id) &&
          this.allies.some(
            (s) =>
              s.id === (l.a === b.id ? l.b : l.a) &&
              s.hp > 0 &&
              distance(s, b) < 5,
          ),
      )
    )
      amount *= 0.65;
    const nearby = this.allies.find(
      (s) => s.general === "zhangfei" && s.hp > 0 && distance(s, a) < 5,
    );
    if (a.side === "enemy" && nearby) amount *= 0.8;
    a.damageDone += this.hurt(b, amount);
    if (a.general === "zhouyu") b.burning = 3;
    this.shots.push({
      id: ++this.serial,
      from: { x: a.x, z: a.z },
      to: { x: b.x, z: b.z },
      ranged: a.type === "bow",
      side: a.side,
      life: a.type === "bow" ? 0.35 : 0.18,
      maxLife: a.type === "bow" ? 0.35 : 0.18,
    });
  }
  stepSquad(a, opponents, dt) {
    if (a.hp <= 0) return;
    a.flash = Math.max(0, (a.flash || 0) - dt);
    a.clock -= dt;
    if (a.burning > 0) {
      a.burning -= dt;
      this.hurt(a, 3 * dt);
      if (a.hp <= 0) return;
    }
    let nearest = null,
      dist = Infinity;
    for (const b of opponents)
      if (b.hp > 0) {
        const d = distance(a, b);
        if (d < dist) {
          nearest = b;
          dist = d;
        }
      }
    let destination = null;
    if (a.stance === "retreat") destination = a.target;
    else if (a.stance === "hold") destination = a.target;
    else if (a.target && distance(a, a.target) > 1) destination = a.target;
    else if (nearest && dist > a.range) destination = nearest;
    else if (!nearest) destination = { x: 0, z: a.side === "ally" ? -17 : 17 };
    if (destination) {
      const d = distance(a, destination);
      if (d > 0.25) {
        const v = direction(destination.x - a.x, destination.z - a.z),
          step = Math.min(
            d,
            a.speed * (a.side === "ally" && this.speedBuff > 0 ? 1.5 : 1) * dt,
          );
        a.x = clamp(a.x + v.x * step, -17, 17);
        a.z = clamp(a.z + v.z * step, -17, 17);
        a.fx = v.x;
        a.fz = v.z;
        if (a.type === "cavalry") a.charge = Math.min(6, a.charge + step);
      }
    }
    if (a.stance !== "retreat" && nearest && distance(a, nearest) <= a.range) {
      const v = direction(nearest.x - a.x, nearest.z - a.z);
      const face = direction(
        a.fx + (v.x - a.fx) * Math.min(1, dt * 4),
        a.fz + (v.z - a.fz) * Math.min(1, dt * 4),
      );
      a.fx = face.x;
      a.fz = face.z;
      if (a.clock <= 0) {
        this.attack(a, nearest);
        const caocao = this.allies.some(
          (s) => s.general === "caocao" && s.hp > 0 && distance(s, a) < 6,
        );
        a.clock = a.interval * (a.side === "ally" && caocao ? 0.9 : 1);
      }
    }
    const base = { x: 0, z: a.side === "ally" ? -17 : 17 };
    if (a.stance === "advance" && distance(a, base) < 3 && a.clock <= 0) {
      const side = a.side === "ally" ? "enemy" : "ally";
      this.headquarters[side] = Math.max(0, this.headquarters[side] - a.damage);
      a.clock = a.interval;
    }
  }
  update(dt) {
    if (this.phase !== "battle") return;
    dt = clamp(dt, 0, 0.05);
    this.time += dt;
    this.totalTime += dt;
    this.command = Math.min(100, this.command + dt * 3);
    this.skillCooldown = Math.max(0, this.skillCooldown - dt);
    this.speedBuff = Math.max(0, this.speedBuff - dt);
    // Alternate which side resolves first to avoid a persistent first-strike advantage.
    const order =
      Math.floor(this.time / 0.05) % 2
        ? [this.allies, this.enemies]
        : [this.enemies, this.allies];
    for (const army of order)
      for (const a of army)
        this.stepSquad(
          a,
          army === this.allies ? this.enemies : this.allies,
          dt,
        );
    for (const army of [this.allies, this.enemies])
      for (let i = 0; i < army.length; i++)
        for (let j = i + 1; j < army.length; j++) {
          const a = army[i],
            b = army[j];
          if (a.hp <= 0 || b.hp <= 0) continue;
          const d = distance(a, b);
          if (d < 2) {
            const v = direction(a.x - b.x || 0.01, a.z - b.z);
            const push = (2 - d) * 0.5;
            a.x = clamp(a.x + v.x * push, -17, 17);
            a.z = clamp(a.z + v.z * push, -17, 17);
            b.x = clamp(b.x - v.x * push, -17, 17);
            b.z = clamp(b.z - v.z * push, -17, 17);
          }
        }
    for (const a of this.allies)
      if (a.hp > 0) {
        const liubei = this.allies.find(
          (s) =>
            s.general === "liubei" &&
            s.hp > 0 &&
            s.id !== a.id &&
            adjacent(s, a) &&
            distance(s, a) < 5,
        );
        if (liubei) a.hp = Math.min(a.maxHp, a.hp + dt * 1.5);
        const oath = this.activeLinks?.some(
          (l) =>
            l.kind === "oath" &&
            (l.a === a.id || l.b === a.id) &&
            this.allies.some(
              (s) =>
                s.id === (l.a === a.id ? l.b : l.a) &&
                s.hp > 0 &&
                distance(s, a) < 5,
            ),
        );
        if (oath) a.hp = Math.min(a.maxHp, a.hp + dt * 0.8);
      }
    const f = this.flag,
      near = this.allies.some((a) => a.hp > 0 && distance(a, f) < 4),
      contested = this.enemies.some((e) => e.hp > 0 && distance(e, f) < 4);
    if (!f.captured && near && !contested) {
      f.progress = Math.min(8, f.progress + dt);
      if (f.progress >= 8) {
        f.captured = true;
        this.captured++;
        this.command = Math.min(100, this.command + 25);
        for (const a of this.allies)
          if (a.hp > 0) a.hp = Math.min(a.maxHp, a.hp + 20);
        this.note("中军旗已夺：指挥 +25，全军回复 20。");
      }
    }
    for (const list of [this.shots, this.effects])
      for (const e of list) e.life -= dt;
    this.shots = this.shots.filter((e) => e.life > 0);
    this.effects = this.effects.filter((e) => e.life > 0);
    const ours = this.allies.some((a) => a.hp > 0),
      theirs = this.enemies.some((a) => a.hp > 0);
    if (!ours || this.headquarters.ally <= 0) {
      this.phase = "lost";
      this.result = "我军失去战斗力";
      this.note("此阵未破。调整兵种和站位，再来一次。");
    } else if (!theirs || this.headquarters.enemy <= 0) this.finishRound();
    else if (this.time >= 100) {
      this.phase = "lost";
      this.result = "战斗超时；需要集中火力或进攻敌营";
    }
  }
  finishRound() {
    if (this.round === 3) {
      this.phase = "won";
      this.result = "三阵连破";
      return;
    }
    this.round++;
    for (const a of this.allies) {
      a.hp = Math.max(a.hp, a.maxHp * 0.55);
      a.hp = Math.min(a.maxHp, a.hp + a.maxHp * 0.25);
      a.burning = 0;
      Object.assign(a, cellPosition(a.col, a.row));
    }
    this.prepareEnemy();
    this.time = 0;
    this.phase = "reward";
    const recruit = this.draftOffer();
    this.offer =
      this.allies.length < 6
        ? [recruit[0], { kind: "heal" }, { kind: "power" }]
        : [{ kind: "heal" }, { kind: "power" }, { kind: "fire" }];
    this.note("战役推进：轻伤队伍归建，选择一次援军或军略。");
  }
}
