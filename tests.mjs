import assert from "node:assert/strict";
import { World, cards } from "./src/world.js";
const tests = [];
function test(name, fn) {
  fn();
  tests.push(name);
  console.log("✓ " + name);
}
const enemy = (id, x, z, hp = 10) => ({
  id,
  x,
  z,
  hp,
  maxHp: hp,
  radius: 0.4,
  speed: 0,
  clock: 10,
  type: "soldier",
});
test("暂停与升级均冻结模拟和夺旗", () => {
  const w = new World();
  w.phase = "upgrade";
  w.update(0.05, { x: 1, z: 0, interact: true });
  assert.equal(w.time, 0);
  w.phase = "paused";
  w.update(0.05);
  assert.equal(w.time, 0);
});
test("零输入闪避安全，气力消耗且不会连续重复触发", () => {
  const w = new World();
  w.start();
  assert(w.dash());
  assert(!w.dash());
  for (let i = 0; i < 6; i++) w.update(0.05);
  assert(Number.isFinite(w.player.x));
  assert(w.player.z < 6);
  assert(w.player.stamina < 2);
});
test("一次枪击可以贯穿多个敌人", () => {
  const w = new World();
  w.start();
  w.enemies = [enemy(1, 0, 4), enemy(2, 0, 2.5)];
  w.update(0.01);
  assert(w.enemies.every((e) => e.hp === 7));
});
test("远处按 E 不夺旗，累计夺旗仅招募及发奖一次", () => {
  const w = new World();
  w.start();
  w.update(0.05, { x: 0, z: 0, interact: true });
  assert.equal(w.flag.progress, 0);
  w.player.z = -5;
  w.player.hp = 1e6;
  for (let i = 0; i < 201; i++) {
    w.enemies = [];
    w.phase = "play";
    w.update(0.05, { x: 0, z: 0, interact: true });
  }
  assert(w.flag.captured);
  assert(w.ally);
  assert.equal(w.events.filter((e) => e === "flag").length, 1);
});
test("升级是三张不重复卡，选择仅应用一次", () => {
  const w = new World();
  w.start();
  w.xp = 5;
  w.update(0.01);
  assert.equal(w.phase, "upgrade");
  assert.equal(new Set(w.choices).size, 3);
  assert(!w.choose("invalid"));
  const id = w.choices[0];
  assert(w.choose(id));
  assert(!w.choose(id));
});
test("突破必须等级和夺旗同时满足，且仅一次", () => {
  const w = new World();
  w.start();
  w.level = 4;
  w.update(0.01);
  assert(!w.breakthrough);
  w.flag.captured = true;
  w.update(0.01);
  assert(w.breakthrough);
  const damage = w.damage;
  w.update(0.01);
  assert.equal(w.damage, damage);
  w.reset();
  assert.equal(w.damage, 3);
});
test("副将对敌发射弩矢，命中贡献独立统计", () => {
  const w = new World();
  w.start();
  w.fire = 100;
  w.ally = { x: -1.5, z: 7.5, fire: 0 };
  w.enemies = [enemy(1, -1.5, 4, 100)];
  for (let i = 0; i < 10; i++) w.update(0.05);
  assert(w.stats.ally > 0);
});
test("无双消耗充能并有范围限制", () => {
  const w = new World();
  w.start();
  w.charge = 100;
  w.enemies = [enemy(1, 0, 5, 100), enemy(2, 20, 20, 100)];
  assert(w.musou());
  assert.equal(w.enemies[0].hp, 75);
  assert.equal(w.enemies[1].hp, 100);
  assert(!w.musou());
});
test("计时结束还需要击败敌将；超时明确失败", () => {
  const w = new World({ duration: 1, bossAt: 0.5 });
  w.start();
  w.time = 1;
  w.update(0.01);
  assert.equal(w.phase, "play");
  w.bossDefeated = true;
  w.update(0.01);
  assert.equal(w.phase, "won");
  const v = new World({ duration: 1, bossAt: 0.5 });
  v.start();
  v.time = 61;
  v.update(0.01);
  assert.equal(v.phase, "over");
});
test("同帧死亡优先，重开恢复全部状态", () => {
  const w = new World({ duration: 1 });
  w.start();
  w.time = 1;
  w.bossDefeated = true;
  w.player.hp = 0;
  w.update(0.01);
  assert.equal(w.phase, "over");
  w.reset();
  assert.equal(w.ally, null);
  assert.equal(w.flag.progress, 0);
  assert.equal(w.level, 1);
  assert.equal(w.player.hp, 100);
});
test("固定种子可复现波次与选择", () => {
  const a = new World(),
    b = new World();
  a.start();
  b.start();
  for (let i = 0; i < 100; i++) {
    a.update(0.05);
    b.update(0.05);
  }
  assert.deepEqual(a.enemies, b.enemies);
});
for (const c of cards) {
  const w = new World();
  assert(c.description(w));
  c.apply(w);
}

test("默认三分钟关卡可以通过走位、夺旗与构筑完成", () => {
  const w = new World();
  w.start();
  for (let i = 0; i < 20000 && !["over", "won"].includes(w.phase); i++) {
    if (w.phase === "upgrade") {
      w.choose(
        w.choices.includes("heal") && w.player.hp < 70
          ? "heal"
          : w.choices.includes("power")
            ? "power"
            : w.choices.includes("haste")
              ? "haste"
              : w.choices[0],
      );
      continue;
    }
    let x, z;
    if (!w.flag.captured) {
      x = w.flag.x - w.player.x;
      z = w.flag.z - w.player.z;
      if (Math.hypot(x, z) < 1) {
        x = 0;
        z = 0;
      }
    } else {
      x = Math.cos(w.time * 0.8) * 5 - w.player.x;
      z = -5 + Math.sin(w.time * 0.8) * 5 - w.player.z;
    }
    if (
      w.enemies.some(
        (e) => Math.hypot(e.x - w.player.x, e.z - w.player.z) < 1.5,
      )
    )
      w.dash();
    if (w.charge >= 100) w.musou();
    w.update(1 / 60, { x, z, interact: true });
  }
  assert.equal(w.phase, "won");
  assert(w.flag.captured && w.ally && w.breakthrough && w.bossDefeated);
  console.log(
    `  模拟战报：${w.time.toFixed(0)} 秒 / ${w.kills} 击破 / LV.${w.level}`,
  );
});

console.log(`${tests.length} 项规则测试通过。`);
