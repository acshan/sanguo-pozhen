import { World, cards } from "./world.js";
import { View } from "./view.js";
const $ = (s) => document.querySelector(s),
  canvas = $("#battle"),
  world = new World();
let view,
  last = 0,
  lastUI = 0,
  phase = "",
  noticeUntil = 0,
  raf,
  settled = false,
  best = 0,
  store = true;
try {
  best = Number(localStorage.getItem("pozhen-best-v1")) || 0;
} catch {
  store = false;
}
const held = new Set(),
  touch = new Map();
let interactive = false;
function clear() {
  held.clear();
  touch.clear();
  interactive = false;
}
function tell(text) {
  $("#notice").textContent = text;
  noticeUntil = performance.now() + 4500;
}
function ui() {
  const p = world.player,
    f = world.flag;
  $("#hp-text").textContent = `${Math.ceil(p.hp)} / ${p.maxHp}`;
  $("#hp-bar").style.width = `${(p.hp / p.maxHp) * 100}%`;
  $("#xp-bar").style.width =
    `${Math.min(100, (world.xp / world.xpNext) * 100)}%`;
  $("#level").textContent =
    `LV.${world.level} · 战意 ${world.xp}/${world.xpNext}`;
  $("#kills").textContent = `击破 ${world.kills}`;
  const remain = Math.ceil(Math.max(0, 180 - world.time));
  $("#clock").textContent =
    `${String(Math.floor(remain / 60)).padStart(2, "0")}:${String(remain % 60).padStart(2, "0")}`;
  $("#stage").textContent = world.bossDefeated
    ? "敌将已破 · 坚守至第三分钟"
    : world.bossSpawned
      ? "决战 · 留意敌将重击预警"
      : "02:30 敌将登场 · 03:00 后可通关";
  $("#rank").textContent = world.breakthrough ? "龙胆觉醒" : "常山少年";
  $("#objective").textContent = f.captured
    ? "阵旗已夺 · 弩手随行"
    : "前往北侧阵旗";
  $("#flag-detail").textContent = f.captured
    ? world.breakthrough
      ? "龙胆已觉醒 · 枪伤 +2 / 距离 +1"
      : "达到 LV.4，触发龙胆突破。"
    : `距阵旗 ${Math.hypot(p.x - f.x, p.z - f.z).toFixed(0)} 步 · 范围内按住 E 累计 10 秒`;
  $("#flag-bar").style.width = `${f.progress * 10}%`;
  $("#stamina").textContent =
    `气力 ${p.stamina >= 1 ? "◆" : "◇"} ${p.stamina >= 2 ? "◆" : "◇"} · 每格 2.6 秒恢复`;
  $("#charge").textContent = `无双 ${Math.floor(world.charge)} / 100`;
  $("#dash").disabled = world.phase !== "play" || p.stamina < 1;
  $("#musou").disabled = world.phase !== "play" || world.charge < 100;
  if (phase === world.phase) return;
  phase = world.phase;
  clear();
  const overlay = $("#overlay");
  overlay.replaceChildren();
  if (phase === "ready")
    overlay.innerHTML = `<div class="panel"><span class="eyebrow">三国 · 破阵录 / 灰盒可玩原型 01</span><h1>一骑入阵。</h1><p>颍川夜深，敌军合围。以赵云之枪破开阵线，<br>夺取阵旗，招募弩手，守住三分钟并击败敌将。</p><button class="primary" data-action="start">赵云 · 出阵 →</button><span class="hint">自动长枪刺击 · 空格闪避 · 按住 E 夺旗 · Q 无双<br>历史最佳 ${best} 次击破 · 无需登录</span></div>`;
  if (phase === "paused")
    overlay.innerHTML =
      '<div class="panel"><span class="eyebrow">整军片刻</span><h1>且听风声。</h1><p>时间、敌军与夺旗进度均已暂停。</p><button class="primary" data-action="resume">重返战场 →</button></div>';
  if (phase === "upgrade") {
    overlay.innerHTML = `<div class="panel"><span class="eyebrow">战意凝聚 / LEVEL ${world.level}</span><h1>择一军略。</h1><p>战场已暂停。每次选择，改变这一局的打法。</p><div class="choice-grid"></div></div>`;
    for (const id of world.choices) {
      const c = cards.find((c) => c.id === id),
        b = document.createElement("button");
      b.className = "choice";
      b.dataset.upgrade = id;
      const tag = document.createElement("small"),
        name = document.createElement("b"),
        desc = document.createElement("span");
      tag.textContent = c.tag;
      name.textContent = c.name;
      desc.textContent = c.description(world);
      b.append(tag, name, desc);
      $(".choice-grid").append(b);
    }
  }
  if (["over", "won"].includes(phase)) {
    if (!settled) {
      best = Math.max(best, world.kills);
      try {
        localStorage.setItem("pozhen-best-v1", String(best));
      } catch {
        store = false;
      }
      settled = true;
    }
    overlay.innerHTML = `<div class="panel"><span class="eyebrow">颍川战报 / ${phase === "won" ? "VICTORY" : "TRY AGAIN"}</span><h1>${phase === "won" ? "此阵，已破。" : "整军，再战。"}</h1><p>${phase === "won" ? "长枪所向，阵线尽开。" : `本次失利：${world.endReason}。试着用闪避穿过包围，避开橙色重击范围。`}</p><div class="report"><span>生存 ${world.time.toFixed(0)} 秒</span><span>击破 ${world.kills}</span><span>阵旗 ${world.flag.captured ? "已夺" : "未夺"}</span><span>LV.${world.level}</span></div><p>枪术 ${Math.round(world.stats.spear)} · 龙影 ${Math.round(world.stats.echo)} · 副将 ${Math.round(world.stats.ally)} · 无双 ${Math.round(world.stats.musou)}<br>${store ? "最佳击破已保存在此浏览器。" : "当前浏览器无法保存纪录。"}</p><button class="primary" data-action="restart">再演一阵 →</button></div>`;
  }
  if (overlay.children.length)
    overlay.querySelector("button")?.focus({ preventScroll: true });
}
function togglePause() {
  world.pause();
  clear();
  ui();
  if (world.phase === "play") canvas.focus({ preventScroll: true });
}
$("#pause").onclick = togglePause;
$("#dash").onclick = () => world.dash();
$("#musou").onclick = () => world.musou();
$("#overlay").onclick = (e) => {
  const id = e.target.closest("[data-upgrade]")?.dataset.upgrade;
  if (id) {
    world.choose(id);
    ui();
    canvas.focus({ preventScroll: true });
    return;
  }
  const a = e.target.closest("[data-action]")?.dataset.action;
  if (a === "restart") {
    world.reset();
    settled = false;
    phase = "";
    world.start();
  }
  if (a === "start") world.start();
  if (a === "resume") world.pause();
  if (a) {
    ui();
    canvas.focus({ preventScroll: true });
  }
};
const controlled = [
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "ArrowUp",
  "ArrowLeft",
  "ArrowDown",
  "ArrowRight",
  "Space",
  "KeyQ",
  "KeyE",
];
window.addEventListener("keydown", (e) => {
  if (e.code === "Escape") {
    e.preventDefault();
    if (!e.repeat) togglePause();
    return;
  }
  if (world.phase !== "play" || !controlled.includes(e.code)) return;
  e.preventDefault();
  held.add(e.code);
  if (!e.repeat && e.code === "Space") world.dash();
  if (!e.repeat && e.code === "KeyQ") world.musou();
});
window.addEventListener("keyup", (e) => held.delete(e.code));
window.addEventListener("blur", () => {
  clear();
  if (world.phase === "play") togglePause();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && world.phase === "play") togglePause();
});
canvas.addEventListener("pointerdown", () =>
  canvas.focus({ preventScroll: true }),
);
for (const b of document.querySelectorAll("[data-move]")) {
  const d = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[
    b.dataset.move
  ];
  b.onpointerdown = (e) => {
    e.preventDefault();
    b.setPointerCapture(e.pointerId);
    touch.set(e.pointerId, d);
  };
  for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
    b.addEventListener(event, (e) => touch.delete(e.pointerId));
}
$("#touch-flag").onpointerdown = (e) => {
  e.preventDefault();
  e.currentTarget.setPointerCapture(e.pointerId);
  interactive = true;
};
for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
  $("#touch-flag").addEventListener(event, () => (interactive = false));
function tick(now) {
  const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
  last = now;
  let x =
      Number(held.has("KeyD") || held.has("ArrowRight")) -
      Number(held.has("KeyA") || held.has("ArrowLeft")),
    z =
      Number(held.has("KeyS") || held.has("ArrowDown")) -
      Number(held.has("KeyW") || held.has("ArrowUp"));
  for (const d of touch.values()) {
    x += d[0];
    z += d[1];
  }
  world.update(dt, { x, z, interact: held.has("KeyE") || interactive });
  for (const e of world.events)
    tell(
      e === "flag"
        ? "阵旗已夺！弩手归队 · 恢复 25 生命"
        : e === "breakthrough"
          ? "龙胆觉醒！枪伤 +2 · 距离 +1"
          : "敌将登场！避开橙色重击范围",
    );
  world.events.length = 0;
  if (now > noticeUntil) $("#notice").textContent = "";
  view.sync(world);
  if (now - lastUI > 80) {
    ui();
    lastUI = now;
  }
  raf = requestAnimationFrame(tick);
}
try {
  view = new View(canvas);
  ui();
  raf = requestAnimationFrame(tick);
} catch (e) {
  $("#error").hidden = false;
  $("#error").textContent =
    "无法启动三维战场，请使用支持 WebGL 2 的浏览器并开启硬件加速。" + e.message;
}
window.addEventListener("pagehide", () => {
  cancelAnimationFrame(raf);
  view?.dispose();
});
