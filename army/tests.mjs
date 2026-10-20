import assert from "node:assert/strict";
import { ArmyWorld, counter, soldierCount, cellPosition } from "./model.js";
let total = 0;
function test(name, fn) {
  fn();
  total++;
  console.log("✓ " + name);
}
function world(seed = 42) {
  const w = new ArmyWorld({ seed });
  w.choose(0);
  return w;
}
test("初始招募三选一，不能重复领取；每将带八兵", () => {
  const w = new ArmyWorld();
  assert.equal(w.allies.length, 3);
  assert.equal(w.offer.length, 3);
  assert.equal(new Set(w.offer.map((o) => o.general)).size, 3);
  assert(w.choose(0));
  assert.equal(w.allies.length, 4);
  assert(!w.choose(0));
  assert(w.allies.every((a) => soldierCount(a) === 8));
});
test("布阵只能放南侧合法格，已占用时交换，不重叠", () => {
  const w = world();
  const [a, b] = w.allies,
    old = [a.col, a.row];
  assert(w.place(a.id, b.col, b.row));
  assert.deepEqual([b.col, b.row], old);
  assert(!w.place(a.id, 3, -1));
  assert(!w.place(a.id, 3.5, 0));
  assert.equal(
    new Set(w.allies.map((s) => `${s.col},${s.row}`)).size,
    w.allies.length,
  );
});
test("邻接关系由布阵决定，调整站位改变盾弓协同", () => {
  const w = world(),
    bow = w.allies.find((a) => a.type === "bow");
  assert(w.links().some((l) => l.kind === "shield"));
  w.place(bow.id, 6, 2);
  assert(
    !w
      .links()
      .some((l) => l.kind === "shield" && (l.a === bow.id || l.b === bow.id)),
  );
});
test("枪骑弓循环克制，盾兵没有凭空克制", () => {
  assert.equal(counter("spear", "cavalry"), 1.45);
  assert.equal(counter("cavalry", "bow"), 1.45);
  assert.equal(counter("bow", "spear"), 1.45);
  assert.equal(counter("shield", "bow"), 1);
});
test("开始战斗后不能瞬移布阵；暂停冻结全部模拟但允许下令", () => {
  const w = world();
  w.begin();
  assert(!w.place(w.allies[0].id, 0, 0));
  w.update(0.05);
  w.pause();
  const snapshot = JSON.stringify([w.time, w.allies, w.enemies, w.command]);
  w.update(0.05);
  assert.equal(
    snapshot,
    JSON.stringify([w.time, w.allies, w.enemies, w.command]),
  );
  w.select(w.allies[0].id);
  assert(w.order("hold", { x: 1, z: 2 }));
  assert.equal(w.allies[0].stance, "hold");
});
test("编组命令有分散目标，单队命令不改其他队", () => {
  const w = world();
  w.begin();
  w.select(w.allies[0].id);
  w.order("retreat");
  assert.equal(w.allies[1].stance, "advance");
  w.select(null);
  w.order("advance", { x: 0, z: 0 });
  assert(new Set(w.allies.map((a) => a.target.x + "," + a.target.z)).size > 1);
});
test("军略消耗指挥点、冷却且只打范围内敌人", () => {
  const w = world();
  w.begin();
  w.command = 100;
  w.enemies[0].x = 0;
  w.enemies[0].z = 0;
  w.enemies[1].x = 12;
  const far = w.enemies[1].hp;
  assert(!w.tactic("fire"));
  assert(w.tactic("fire", { x: 0, z: 0 }));
  assert.equal(w.command, 60);
  assert(w.enemies[0].hp < w.enemies[0].maxHp);
  assert.equal(w.enemies[1].hp, far);
  assert(!w.tactic("heal"));
});
test("骑兵蓄力强化命中；长枪坚守降低冲锋损伤", () => {
  const w = world();
  w.begin();
  const a = w.makeSquad("cavalry", "enemy", { x: 0, z: 0 }),
    b = w.makeSquad("spear", "ally", { x: 0, z: 1 });
  b.stance = "hold";
  a.charge = 4;
  w.attack(a, b);
  const defended = b.maxHp - b.hp;
  const c = w.makeSquad("spear", "ally", { x: 0, z: 1 });
  a.charge = 4;
  w.attack(a, c);
  assert(defended < c.maxHp - c.hp);
  assert.equal(a.charge, 0);
});
test("伤亡改变可见兵数与输出，不是只放装饰士兵", () => {
  const w = world(),
    a = w.allies[0];
  assert.equal(soldierCount(a), 8);
  a.hp = a.maxHp * 0.5;
  assert.equal(soldierCount(a), 4);
  a.hp = 0;
  assert.equal(soldierCount(a), 0);
});
test("胜利整补进入奖励阶段，第三场胜利结束战役", () => {
  const w = world();
  w.begin();
  w.enemies.forEach((e) => (e.hp = 0));
  w.update(0.01);
  assert.equal(w.phase, "reward");
  assert.equal(w.round, 2);
  w.choose(1);
  assert.equal(w.phase, "plan");
  w.begin();
  w.enemies.forEach((e) => (e.hp = 0));
  w.update(0.01);
  w.choose(1);
  w.begin();
  w.enemies.forEach((e) => (e.hp = 0));
  w.update(0.01);
  assert.equal(w.phase, "won");
});
test("全军覆没同帧优先于胜利，重开清空军令和强化", () => {
  const w = world();
  w.begin();
  [...w.allies, ...w.enemies].forEach((a) => (a.hp = 0));
  w.update(0.05);
  assert.equal(w.phase, "lost");
  w.damageBonus = 3;
  w.reset();
  assert.equal(w.phase, "draft");
  assert.equal(w.damageBonus, 1);
  assert.equal(w.round, 1);
  assert.equal(w.stats.orders, 0);
});
test("中军旗需无敌军争夺才能累积，奖励只发一次", () => {
  const w = world();
  w.begin();
  w.enemies[0].x = w.allies[0].x = 0;
  w.enemies[0].z = w.allies[0].z = 0;
  w.allies.forEach((a) => (a.stance = "hold"));
  w.enemies.forEach((a) => (a.stance = "hold"));
  w.update(0.01);
  assert.equal(w.flag.progress, 0);
  w.enemies.forEach((e) => {
    e.x = 15;
    e.z = -15;
  });
  w.allies[0].x = 0;
  w.allies[0].z = 0;
  w.flag.progress = 7.99;
  w.update(0.05);
  assert(w.flag.captured);
  assert.equal(w.captured, 1);
  w.update(0.05);
  assert.equal(w.captured, 1);
});
test("固定种子重现招募与敌情", () => {
  const a = new ArmyWorld({ seed: 11 }),
    b = new ArmyWorld({ seed: 11 });
  assert.deepEqual(a.offer, b.offer);
  assert.deepEqual(a.enemies, b.enemies);
});
test("完整三场默认规则可通过军略与援军完成", () => {
  const w = world(42);
  w.begin();
  let steps = 0;
  while (!["won", "lost"].includes(w.phase) && steps++ < 40000) {
    if (w.phase === "reward") {
      w.choose(0);
      w.begin();
    }
    if (w.phase === "battle" && w.skillCooldown <= 0) {
      const hurt = w.allies.some((a) => a.hp > 0 && a.hp / a.maxHp < 0.4);
      if (hurt && w.command >= 35) w.tactic("heal");
      else if (w.command >= 40) {
        const alive = w.enemies.filter((e) => e.hp > 0),
          e = alive.sort(
            (a, b) =>
              alive.filter((t) => Math.hypot(t.x - b.x, t.z - b.z) < 4).length -
              alive.filter((t) => Math.hypot(t.x - a.x, t.z - a.z) < 4).length,
          )[0];
        if (e) w.tactic("fire", e);
      }
    }
    w.update(1 / 60);
  }
  assert.equal(w.phase, "won");
  assert.equal(w.round, 3);
  assert.equal(w.allies.length, 6);
  console.log(
    `  三阵模拟：${w.totalTime.toFixed(1)} 秒战斗 / ${w.stats.fire} 次火计`,
  );
});

test("阵亡部队不能浪费整军点数，无效坐标不能污染行军目标", () => {
  const w = world();
  w.begin();
  w.select(w.allies[0].id);
  w.allies[0].hp = 0;
  const before = w.command;
  assert(!w.tactic("heal"));
  assert.equal(w.command, before);
  assert(!w.order("advance"));
  w.select(null);
  assert(!w.order("advance", { x: NaN, z: 0 }));
  assert(w.allies.every((a) => Number.isFinite(a.x) && Number.isFinite(a.z)));
});

console.log(`${total} 项军势规则测试通过。`);
