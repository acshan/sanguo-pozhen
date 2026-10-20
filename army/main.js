import {
  ArmyWorld,
  GENERALS,
  TYPES,
  FORMATIONS,
  soldierCount,
} from "./model.js";
import { ArmyView } from "./view.js";
const $ = (s) => document.querySelector(s),
  canvas = $("#battle"),
  world = new ArmyWorld({ seed: Math.floor(Math.random() * 1e8) });
let view,
  last = 0,
  uiAt = 0,
  overlayKey = "",
  rosterKey = "",
  raf,
  tipUntil = 0,
  settled = false,
  best = 0;
try {
  best = Number(localStorage.getItem("pozhen-army-best-v1")) || 0;
} catch {}
const gen = (id) => GENERALS.find((g) => g.id === id),
  roundNames = ["颍川前哨", "营寨攻坚", "虎牢决战"];
const typeSymbol = { shield: "盾", spear: "枪", bow: "弓", cavalry: "骑" };
function tell(text) {
  $("#tip").textContent = text;
  tipUntil = performance.now() + 4500;
}
function roster() {
  const key = world.allies.map((a) => a.id).join(",");
  if (key !== rosterKey) {
    rosterKey = key;
    $("#roster").replaceChildren();
    $("#quick-select").replaceChildren();
    for (const [i, a] of world.allies.entries()) {
      const b = document.createElement("button");
      b.className = "squad-card";
      b.dataset.squad = a.id;
      b.title = gen(a.general).detail + "；" + TYPES[a.type].role;
      b.innerHTML = `<span class="type-icon"></span><span class="squad-body"><span class="squad-top"><b></b><small></small></span><span class="squad-desc"></span><span class="squad-bar"><i></i></span></span>`;
      b.querySelector("b").textContent = `${i + 1} · ${a.name}`;
      b.querySelector(".type-icon").textContent = typeSymbol[a.type];
      b.querySelector(".type-icon").style.color = TYPES[a.type].color;
      b.onclick = () => {
        world.select(a.id);
        tell(
          world.phase === "plan"
            ? `已选${a.name}：点击南侧布阵格；占用格会交换位置。`
            : `已选${a.name}：点战场行军，或选择坚守 / 回撤。`,
        );
        render();
      };
      $("#roster").append(b);
      const quick = document.createElement("button");
      quick.dataset.quick = a.id;
      quick.textContent = `${a.name} · ${typeSymbol[a.type]}`;
      quick.onclick = b.onclick;
      $("#quick-select").append(quick);
    }
  }
  for (const a of world.allies) {
    const quick = document.querySelector(`[data-quick="${a.id}"]`);
    quick.classList.toggle("selected", world.selected === a.id);
    const b = document.querySelector(`[data-squad="${a.id}"]`);
    b.className =
      "squad-card" +
      (world.selected === a.id ? " selected" : "") +
      (a.hp <= 0 ? " dead" : "");
    b.querySelector("small").textContent = `${soldierCount(a)}/8 兵`;
    b.querySelector(".squad-bar i").style.width =
      `${Math.max(0, (a.hp / a.maxHp) * 100)}%`;
    b.querySelector(".squad-desc").textContent =
      `${TYPES[a.type].name} · ${gen(a.general).skill} · ${world.phase === "plan" ? `第${a.row + 1}排 / 第${a.col + 1}列` : a.hp <= 0 ? "撤离待整补" : { advance: "推进", hold: "坚守", retreat: "回撤" }[a.stance]}`;
  }
}
function cardContent(c) {
  if (c.kind === "recruit") {
    const g = gen(c.general);
    return {
      tag: `招募 / ${TYPES[g.type].name}`,
      name: g.name,
      desc: g.detail,
      foot: `自带 8 名${g.type === "cavalry" ? "骑兵" : TYPES[g.type].name + "兵"} · ${TYPES[g.type].role}`,
    };
  }
  return {
    heal: {
      tag: "补给 / 续战",
      name: "粮秣整补",
      desc: "全军额外恢复 50% 最大兵力，让现有阵容继续作战。",
      foot: "适合重伤军势",
    },
    power: {
      tag: "军略 / 武备",
      name: "百炼军械",
      desc: "全军伤害永久 +18%，作用于本次三场战役。",
      foot: "适合已经成形的阵容",
    },
    fire: {
      tag: "军略 / 火攻",
      name: "烈火连营",
      desc: "军师火计伤害 +40%，作用于后续战斗。",
      foot: "强化指挥点的价值",
    },
  }[c.kind];
}
function overlay() {
  const key = `${world.phase}-${world.round}`;
  if (key === overlayKey) return;
  overlayKey = key;
  const host = $("#overlay");
  host.replaceChildren();
  if (["draft", "reward"].includes(world.phase)) {
    host.innerHTML = `<div class="draft-panel"><span class="eyebrow">${world.phase === "draft" ? "从一名武将，到一支军势" : "战役间歇 / 随机构筑"}</span><h2>${world.phase === "draft" ? "择将，立阵。" : "下一阵，如何破？"}</h2><p>${world.phase === "draft" ? "你指挥部队，不直接操控单个武将。先招募援军，再把盾、枪、弓、骑放到合适的位置。" : "轻伤部队已经整补归建。选择新的援军、恢复兵力，或强化全军，再调整下一场布阵。"}</p><div class="draft-cards"></div><div class="flow">随机招募 → 战前布阵 → 暂停布令 / 自动交锋 → 整军再战</div></div>`;
    world.offer.forEach((c, i) => {
      const content = cardContent(c),
        b = document.createElement("button");
      b.className = "draft-card";
      const tag = document.createElement("small"),
        name = document.createElement("b"),
        desc = document.createElement("span"),
        foot = document.createElement("em");
      tag.textContent = content.tag;
      name.textContent = content.name;
      desc.textContent = content.desc;
      foot.textContent = content.foot;
      b.append(tag, name, desc, foot);
      b.onclick = () => {
        if (world.choose(i)) {
          world.select(world.allies.at(-1).id);
          render();
          tell("选择部队卡，再点击南侧格子布阵。前排靠近中军旗。");
        }
      };
      $(".draft-cards").append(b);
    });
  }
  if (["won", "lost"].includes(world.phase)) {
    if (!settled) {
      best = Math.max(best, world.phase === "won" ? 3 : world.round - 1);
      try {
        localStorage.setItem("pozhen-army-best-v1", String(best));
      } catch {}
      settled = true;
    }
    host.innerHTML = `<div class="draft-panel"><span class="eyebrow">军师战报 / ${world.phase === "won" ? "VICTORY" : "REPLAN"}</span><h2>${world.phase === "won" ? "此三阵，已破。" : "胜负，在下一次布阵。"}</h2><p>${world.phase === "won" ? "这一次，是你的调度带着军势赢下了战场。" : world.result + "。试着让盾队在前、弓队居后，枪队挡骑，再用暂停重整战线。"}</p><div class="battle-report"><span>军令 ${world.stats.orders} 次</span><span>克制命中 ${world.stats.counters}</span><span>侧后夹击 ${world.stats.flanks}</span><span>夺旗 ${world.captured} 次</span></div><p>本局种子 ${world.seed} · 累计战斗 ${world.totalTime.toFixed(0)} 秒 · 最佳连破 ${best} 阵</p><button class="primary" id="again">再演一阵 →</button></div>`;
    $("#again").onclick = restart;
  }
}
function render() {
  document.body.dataset.phase = world.phase;
  $("#round-label").textContent =
    `第 ${world.round} 阵 · ${roundNames[world.round - 1]}`;
  $("#roster-count").textContent = `${world.allies.length}/6`;
  const alive = (list) => list.reduce((n, s) => n + soldierCount(s), 0);
  $("#strength").textContent =
    `${alive(world.allies)} / ${alive(world.enemies)} 兵`;
  $("#phase-label").textContent = {
    draft: "筹军",
    plan: "战前布阵",
    battle: "自动交锋",
    tactics: "战术暂停",
    reward: "援军与军略",
    won: "三阵连破",
    lost: "整军再战",
  }[world.phase];
  $("#clock").textContent = ["battle", "tactics"].includes(world.phase)
    ? `${Math.floor(world.time)} / 100 秒 · 我营 ${Math.round(world.headquarters.ally)} / 敌营 ${Math.round(world.headquarters.enemy)}`
    : "每将一队兵 · 最多六队 · 三场连战";
  $("#flag-label").textContent = world.flag.captured
    ? "已夺取"
    : `争夺 ${Math.round((world.flag.progress / 8) * 100)}%`;
  $("#instruction").textContent =
    world.phase === "plan"
      ? "点击部队卡，再点南侧格子。前排更靠近敌军；占用格自动交换。确认后出阵。"
      : world.targetMode === "fire"
        ? "火计待命：点击战场指定范围。Esc 取消；不会因点击部队卡而浪费指挥点。"
        : world.phase === "tactics"
          ? "时间停止，可选队、指定行军位置、切阵或下军略。再次按空格继续。"
          : "点击部队卡选队，再点战场行军。全军也可编组下令；数字 1–6 选队，0 选全军。";
  $("#command").textContent = `${Math.floor(world.command)} / 100`;
  $("#tactics-banner").hidden = world.phase !== "tactics";
  $("#pause").textContent =
    world.phase === "tactics" ? "继续交锋 · Space" : "战术暂停 · Space";
  $("#begin").hidden = world.phase !== "plan";
  const active = ["battle", "tactics"].includes(world.phase);
  $("#pause").disabled = !active;
  for (const b of document.querySelectorAll("[data-order]"))
    b.disabled = !active;
  $("#all").classList.toggle("selected", world.selected === null);
  for (const b of document.querySelectorAll("[data-tactic]")) {
    b.disabled =
      !active ||
      world.skillCooldown > 0 ||
      world.command < { fire: 40, heal: 35, speed: 25 }[b.dataset.tactic];
    b.classList.toggle("active", world.targetMode === b.dataset.tactic);
  }
  for (const b of document.querySelectorAll("[data-formation]")) {
    b.disabled = !["plan", "battle", "tactics"].includes(world.phase);
    b.classList.toggle(
      "active",
      (world.allies.find((s) => s.id === world.selected)?.formation ??
        world.formation) === b.dataset.formation,
    );
  }
  roster();
  const links = world.links();
  $("#synergies").replaceChildren();
  if (!links.length) {
    $("#synergies").textContent = "尚无协同。把盾与弓放在相邻格试试。";
  }
  for (const l of links) {
    const p = document.createElement("div");
    p.className = "synergy";
    p.textContent = `${l.name} · ${world.allies.find((a) => a.id === l.a).name} ↔ ${world.allies.find((a) => a.id === l.b).name}`;
    p.title =
      l.kind === "shield"
        ? "战前相邻且战中距离小于 5：弓队受到的远程伤害降低 35%"
        : "战前相邻且战中距离小于 5：持续恢复少量兵力";
    $("#synergies").append(p);
  }
  const counts = {};
  for (const e of world.enemies)
    if (e.hp > 0) counts[e.type] = (counts[e.type] || 0) + 1;
  $("#scouting").replaceChildren();
  for (const [type, n] of Object.entries(counts)) {
    const s = document.createElement("span");
    s.className = "scout-type";
    s.style.color = TYPES[type].color;
    s.textContent = `${typeSymbol[type]} ${TYPES[type].name} ×${n}`;
    $("#scouting").append(s);
  }
  $("#log").replaceChildren();
  for (const text of world.log) {
    const p = document.createElement("p");
    p.textContent = text;
    $("#log").append(p);
  }
  overlay();
}
function restart() {
  world.seed = Math.floor(Math.random() * 1e8);
  world.reset();
  settled = false;
  world.targetMode = "move";
  render();
}
$("#restart").onclick = restart;
$("#all").onclick = () => {
  world.select(null);
  render();
  tell("已选全军。点击战场指定全军行进方向。");
};
$("#begin").onclick = () => {
  if (world.begin()) {
    world.select(null);
    render();
  }
};
$("#pause").onclick = () => {
  world.pause();
  render();
};
for (const b of document.querySelectorAll("[data-order]"))
  b.onclick = () => {
    world.targetMode = "move";
    world.order(b.dataset.order);
    render();
  };
for (const b of document.querySelectorAll("[data-formation]"))
  b.onclick = () => {
    world.setFormation(b.dataset.formation);
    render();
    tell(
      `${FORMATIONS[b.dataset.formation].name}：${FORMATIONS[b.dataset.formation].detail}`,
    );
  };
for (const b of document.querySelectorAll("[data-tactic]"))
  b.onclick = () => {
    const kind = b.dataset.tactic;
    if (kind === "fire") {
      world.targetMode = world.targetMode === "fire" ? "move" : "fire";
      tell(
        world.targetMode === "fire"
          ? "火计待命：点击敌军聚集处施放，Esc 取消。"
          : "已取消火计。",
      );
    } else world.tactic(kind);
    render();
  };
canvas.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  const p = view?.point(e.clientX, e.clientY);
  if (!p) return;
  if (world.phase === "plan") {
    if (world.selected === null) {
      tell("先点击右侧的一张武将部队卡，再选择布阵格。");
      return;
    }
    const col = Math.round(p.x / 4 + 3),
      row = Math.round((p.z - 7) / 3.5);
    if (!world.place(world.selected, col, row))
      tell("请选择南侧蓝绿色布阵格。");
    else tell("布阵已更新。青色连线代表盾弓协防，金色代表同袍相援。");
  } else if (["battle", "tactics"].includes(world.phase)) {
    if (world.targetMode === "fire") {
      if (world.tactic("fire", p)) {
        world.targetMode = "move";
        tell("火计已下。");
      } else tell("指挥点不足或军略尚在冷却。");
    } else {
      const hit = world.allies.find(
        (a) => a.hp > 0 && Math.hypot(a.x - p.x, a.z - p.z) < 1.6,
      );
      if (hit) {
        world.select(hit.id);
        tell(`已选 ${hit.name} · ${TYPES[hit.type].name}`);
      } else world.order("advance", p);
    }
  }
  render();
});
window.addEventListener("keydown", (e) => {
  if (
    e.target instanceof HTMLInputElement ||
    e.target instanceof HTMLTextAreaElement
  )
    return;
  if (e.code === "Space") {
    e.preventDefault();
    if (!e.repeat) {
      world.pause();
      render();
    }
  } else if (e.code === "Escape") {
    world.targetMode = "move";
    render();
  } else if (/^Digit[0-6]$/.test(e.code)) {
    const n = Number(e.code.at(-1));
    world.select(n === 0 ? null : (world.allies[n - 1]?.id ?? null));
    render();
  } else if (["KeyA", "KeyH", "KeyR"].includes(e.code)) {
    world.order({ KeyA: "advance", KeyH: "hold", KeyR: "retreat" }[e.code]);
    render();
  }
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && world.phase === "battle") {
    world.pause();
    render();
  }
});
window.addEventListener("blur", () => {
  if (world.phase === "battle") {
    world.pause();
    render();
  }
});
function tick(now) {
  const dt = last ? (now - last) / 1000 : 0;
  last = now;
  world.update(dt);
  view.sync(world);
  if (now - uiAt > 120) {
    render();
    uiAt = now;
  }
  if (now > tipUntil) $("#tip").textContent = "";
  raf = requestAnimationFrame(tick);
}
try {
  view = new ArmyView(canvas);
  render();
  raf = requestAnimationFrame(tick);
} catch (e) {
  $("#error").hidden = false;
  $("#error").textContent = `无法启动军势战场，需要 WebGL 2：${e.message}`;
}
window.addEventListener("pagehide", () => {
  cancelAnimationFrame(raf);
  view?.dispose();
});
