// BMW Breakdown — an endless runner about a car that hates you.
// Behind-the-car perspective, 3 lanes. Drive through motor faults to
// collect oil; jump the ramp to clear a service shop or pay for it.

const SAVE_KEY = "bmwBreakdownRunSave";

const MODELS = [
  {
    id: "e30", name: 'E30 "The Beater"', emoji: "🚙", unlockAt: 0,
    speed: 1.0, spawnMinMs: 950, spawnMaxMs: 1550, oilValue: 9, shopChance: 0.26,
    color: "#3a6ea8", tailShape: "boxy",
    blurb: "Held together with duct tape and hope.",
  },
  {
    id: "e46", name: 'E46 "The Sweet Spot"', emoji: "🚗", unlockAt: 600,
    speed: 1.18, spawnMinMs: 850, spawnMaxMs: 1350, oilValue: 14, shopChance: 0.30,
    color: "#1c4a7a", tailShape: "round",
    blurb: "Everyone's favorite. Still finds new ways to die.",
  },
  {
    id: "f30", name: 'F30 "The Lease Special"', emoji: "🚘", unlockAt: 2200,
    speed: 1.42, spawnMinMs: 750, spawnMaxMs: 1200, oilValue: 22, shopChance: 0.34,
    color: "#8a8f99", tailShape: "slim",
    blurb: "Turbo lag, run-flats, and a dealer on speed dial.",
  },
  {
    id: "g20", name: 'G20 "iDrive Nightmare"', emoji: "🏎️", unlockAt: 6000,
    speed: 1.7, spawnMinMs: 620, spawnMaxMs: 1000, oilValue: 34, shopChance: 0.38,
    color: "#262b35", tailShape: "slim",
    blurb: "The infotainment system breaks down more than the engine.",
  },
];

const BREAKDOWN_REASONS = [
  "It's the water pump. It's always the water pump.",
  "iDrive rebooted itself into a coma.",
  "Check Engine Light achieved sentience.",
  "The M badge fell off out of shame.",
  "Electrical gremlins are throwing a rave in the fuse box.",
  "Coolant is now just a suggestion.",
  "Timing chain stretched like your patience.",
  "VANOS solenoid filed for divorce.",
  "The infamous BMW death rattle has returned.",
  "Battery drained itself out of spite overnight.",
];

const GAMEOVER_QUOTES = [
  "\"It's a great car when it runs.\" — everyone, always",
  "You have been visited by the Bavarian Breakdown Fairy.",
  "The dealership sends their regards, and an invoice.",
  "Somewhere, a mechanic just bought a boat.",
  "It wasn't the miles. It was the years. And the miles.",
  "RIP. Cause of death: German engineering.",
];

// --- geometry ---------------------------------------------------------
const LANE_COUNT = 3;
const NEAR_LANE_X = [0.22, 0.5, 0.78];
const FAR_LANE_X = [0.47, 0.5, 0.53];
const FAR_Y = 0.16;
const NEAR_Y = 0.82;
const FAR_SCALE = 0.2;
const NEAR_SCALE = 0.92;
const COLLIDE_ENTER = 0.9;
const COLLIDE_EXIT = 1.06;
const REMOVE_AT = 1.18;
const BASE_TRAVEL_MS = 2300;
const JUMP_MS = 520;
const JUMP_HEIGHT = 44;
const LIVES_MAX = 3;
const SHOP_PENALTY_PCT = 0.1;
const LANE_EASE = 0.28;

let save = loadSave();
let world = null;
let appState = "idle"; // idle | running | over
let rafId = null;
let lastFrameTime = 0;
let canvas, ctx, cw = 0, ch = 0;

const el = {
  canvasWrap: document.getElementById("game-canvas-wrap"),
  startOverlay: document.getElementById("start-overlay"),
  startBtn: document.getElementById("start-btn"),
  laneLeftBtn: document.getElementById("lane-left-btn"),
  jumpBtn: document.getElementById("jump-btn"),
  laneRightBtn: document.getElementById("lane-right-btn"),
  tiltBtn: document.getElementById("tilt-btn"),
  tiltHint: document.getElementById("tilt-hint"),
  modelSelect: document.getElementById("model-select"),
  oil: document.getElementById("oil"),
  distance: document.getElementById("distance"),
  lives: document.getElementById("lives"),
  faults: document.getElementById("faults"),
  best: document.getElementById("best"),
  gameover: document.getElementById("gameover"),
  gameoverStats: document.getElementById("gameover-stats"),
  gameoverQuote: document.getElementById("gameover-quote"),
  restartBtn: document.getElementById("restart-btn"),
};

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* localStorage unavailable, ignore */ }
  return { lifetimeOil: 0, bestDistance: 0, selectedModel: "e30" };
}

function persistSave() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* ignore */ }
}

function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
function lerp(a, b, t) { return a + (b - a) * t; }
function rand(min, max) { return min + Math.random() * (max - min); }
function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function currentModel() {
  return MODELS.find((m) => m.id === save.selectedModel) || MODELS[0];
}

function pickModel(id) {
  const model = MODELS.find((m) => m.id === id) || MODELS[0];
  if (save.lifetimeOil < model.unlockAt) return;
  save.selectedModel = model.id;
  persistSave();
  renderModelSelect();
  goIdle();
}

function renderModelSelect() {
  el.modelSelect.innerHTML = "";
  MODELS.forEach((m) => {
    const unlocked = save.lifetimeOil >= m.unlockAt;
    const btn = document.createElement("button");
    btn.className = "model-btn" + (m.id === save.selectedModel ? " active" : "");
    btn.disabled = !unlocked;
    btn.innerHTML = `${m.emoji} ${m.name}<small>${unlocked ? m.blurb : "Unlocks at " + m.unlockAt.toLocaleString() + " lifetime oil"}</small>`;
    btn.addEventListener("click", () => pickModel(m.id));
    el.modelSelect.appendChild(btn);
  });
}

// --- canvas setup -------------------------------------------------------
function initCanvas() {
  canvas = document.getElementById("game-canvas");
  ctx = canvas.getContext("2d");
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);
}

function resizeCanvas() {
  const rect = el.canvasWrap.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  cw = rect.width;
  ch = rect.height;
  canvas.width = Math.max(1, Math.round(cw * dpr));
  canvas.height = Math.max(1, Math.round(ch * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

// --- game state -----------------------------------------------------
function newWorld() {
  return {
    model: currentModel(),
    oil: 0,
    distance: 0,
    lives: LIVES_MAX,
    faults: 0,
    lane: 1,
    laneVisual: 1,
    jumping: false,
    jumpStart: 0,
    obstacles: [],
    spawnAt: performance.now() + 500,
    speedMul: 1,
    nextId: 1,
    toastText: "",
    toastUntil: 0,
    flashUntil: 0,
  };
}

function goIdle() {
  cancelAnimationFrame(rafId);
  appState = "idle";
  world = newWorld();
  el.gameover.classList.add("hidden");
  el.startOverlay.classList.remove("hidden");
  updateHud();
  lastFrameTime = performance.now();
  rafId = requestAnimationFrame(idleLoop);
}

function idleLoop(now) {
  render(now);
  if (appState === "idle") rafId = requestAnimationFrame(idleLoop);
}

function startRun() {
  cancelAnimationFrame(rafId);
  world = newWorld();
  appState = "running";
  el.startOverlay.classList.add("hidden");
  el.gameover.classList.add("hidden");
  updateHud();
  lastFrameTime = performance.now();
  rafId = requestAnimationFrame(loop);
}

function ensureRunning() {
  if (appState === "idle") { startRun(); return true; }
  return appState === "running";
}

function endRun() {
  appState = "over";
  cancelAnimationFrame(rafId);
  const distMi = Math.floor(world.distance);
  save.lifetimeOil += Math.floor(world.oil);
  if (distMi > save.bestDistance) save.bestDistance = distMi;
  persistSave();
  renderModelSelect();

  el.gameoverStats.textContent = `You collected ${Math.floor(world.oil).toLocaleString()} oil, drove ${distMi.toLocaleString()} mi, and cleared ${world.faults} fault${world.faults === 1 ? "" : "s"} before the shop finally got you.`;
  el.gameoverQuote.textContent = pickRandom(GAMEOVER_QUOTES);
  el.gameover.classList.remove("hidden");
  updateHud();
}

// --- controls ---------------------------------------------------------
function setLane(delta) {
  if (!ensureRunning()) return;
  world.lane = clamp(world.lane + delta, 0, LANE_COUNT - 1);
}

function jump() {
  if (!ensureRunning()) return;
  if (world.jumping) return;
  world.jumping = true;
  world.jumpStart = performance.now();
}

window.addEventListener("keydown", (e) => {
  if (e.repeat) return;
  if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") { setLane(-1); }
  else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") { setLane(1); }
  else if (e.key === " " || e.key === "ArrowUp" || e.key === "w" || e.key === "W") {
    e.preventDefault();
    if (!ensureRunning()) return;
    jump();
  }
});

el.laneLeftBtn.addEventListener("click", () => setLane(-1));
el.laneRightBtn.addEventListener("click", () => setLane(1));
el.jumpBtn.addEventListener("click", () => jump());
el.startBtn.addEventListener("click", startRun);
el.restartBtn.addEventListener("click", startRun);

// --- tilt steering (phone accelerometer) -------------------------------
const TILT_THRESHOLD = 9; // degrees off center to trigger a lane change
const TILT_REARM = 3.5; // degrees back toward center before it can trigger again
let tiltEnabled = false;
let tiltCenter = null;
let tiltArmed = true;
let tiltGotReading = false;
let tiltWatchdog = null;

function handleOrientation(e) {
  if (e.gamma === null || e.gamma === undefined) return;
  tiltGotReading = true;
  if (tiltCenter === null) tiltCenter = e.gamma;
  const delta = e.gamma - tiltCenter;
  if (tiltArmed) {
    if (delta < -TILT_THRESHOLD) { setLane(-1); tiltArmed = false; }
    else if (delta > TILT_THRESHOLD) { setLane(1); tiltArmed = false; }
  } else if (Math.abs(delta) < TILT_REARM) {
    tiltArmed = true;
  }
}

function setTiltUi(on) {
  tiltEnabled = on;
  el.tiltBtn.textContent = on ? "📱 Tilt Steering: On (tap to recenter)" : "📱 Tilt Steering: Off";
  el.tiltBtn.classList.toggle("active", on);
}

function disableTilt(showUnavailable) {
  window.removeEventListener("deviceorientation", handleOrientation);
  if (tiltWatchdog) { clearTimeout(tiltWatchdog); tiltWatchdog = null; }
  setTiltUi(false);
  el.tiltHint.classList.toggle("hidden", !showUnavailable);
}

async function enableTilt() {
  el.tiltHint.classList.add("hidden");
  if (typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function") {
    try {
      const result = await DeviceOrientationEvent.requestPermission();
      if (result !== "granted") { disableTilt(true); return; }
    } catch (err) { disableTilt(true); return; }
  } else if (typeof DeviceOrientationEvent === "undefined") {
    disableTilt(true);
    return;
  }
  tiltCenter = null;
  tiltArmed = true;
  tiltGotReading = false;
  window.addEventListener("deviceorientation", handleOrientation);
  setTiltUi(true);
  tiltWatchdog = setTimeout(() => {
    if (!tiltGotReading) disableTilt(true);
  }, 1500);
}

el.tiltBtn.addEventListener("click", () => {
  if (tiltEnabled) {
    // Already on: treat a tap as "recenter" rather than turning it off,
    // since that's almost always what you want mid-run.
    tiltCenter = null;
    tiltArmed = true;
  } else {
    enableTilt();
  }
});

// --- spawning & collision ---------------------------------------------
function spawnObstacle(now) {
  const busyLanes = new Set(world.obstacles.filter((o) => o.progress < 0.85).map((o) => o.lane));
  const availableLanes = [0, 1, 2].filter((l) => !busyLanes.has(l));
  if (availableLanes.length === 0) return;
  const lane = pickRandom(availableLanes);
  const isShop = Math.random() < world.model.shopChance;
  world.obstacles.push({
    id: world.nextId++,
    type: isShop ? "shop" : "fault",
    lane,
    progress: 0,
    resolved: false,
    value: isShop ? 0 : Math.round(world.model.oilValue * (0.8 + Math.random() * 0.4)),
  });
}

function showToast(text, now, durationMs) {
  world.toastText = text;
  world.toastUntil = now + durationMs;
}

function resolveObstacle(ob, now) {
  ob.resolved = true;
  if (ob.type === "fault") {
    world.oil += ob.value;
    world.faults += 1;
    showToast(`+${ob.value} 🛢️`, now, 650);
  } else if (world.jumping) {
    showToast("Cleared the ramp!", now, 700);
  } else {
    const penalty = Math.round(world.oil * SHOP_PENALTY_PCT);
    world.oil = Math.max(0, world.oil - penalty);
    world.lives -= 1;
    world.flashUntil = now + 220;
    showToast(pickRandom(BREAKDOWN_REASONS) + (penalty > 0 ? ` (-${penalty} oil)` : ""), now, 1500);
    if (world.lives <= 0) {
      endRun();
    }
  }
}

// --- main loop ----------------------------------------------------------
function loop(now) {
  const dt = Math.min(48, now - lastFrameTime);
  lastFrameTime = now;
  update(dt, now);
  render(now);
  if (appState === "running") rafId = requestAnimationFrame(loop);
}

function update(dt, now) {
  world.speedMul = Math.min(2.3, 1 + world.distance / 1800);
  const travelMs = BASE_TRAVEL_MS / (world.model.speed * world.speedMul);

  world.distance += world.model.speed * world.speedMul * (dt / 1000) * 9;
  world.laneVisual += (world.lane - world.laneVisual) * LANE_EASE;

  if (now >= world.spawnAt) {
    spawnObstacle(now);
    const gapMul = Math.max(0.55, 1 - world.distance / 2600);
    world.spawnAt = now + rand(world.model.spawnMinMs, world.model.spawnMaxMs) * gapMul;
  }

  if (world.jumping && now - world.jumpStart >= JUMP_MS) world.jumping = false;

  for (const ob of world.obstacles) {
    ob.progress += dt / travelMs;
    if (!ob.resolved && ob.progress >= COLLIDE_ENTER && ob.progress <= COLLIDE_EXIT && ob.lane === world.lane) {
      resolveObstacle(ob, now);
      if (appState !== "running") break;
    }
  }
  world.obstacles = world.obstacles.filter((ob) => ob.progress < REMOVE_AT);

  updateHud();
}

// --- rendering ------------------------------------------------------
function laneXAt(laneFloat, t) {
  const lo = clamp(Math.floor(laneFloat), 0, LANE_COUNT - 1);
  const hi = clamp(Math.ceil(laneFloat), 0, LANE_COUNT - 1);
  const f = laneFloat - lo;
  const near = lerp(NEAR_LANE_X[lo], NEAR_LANE_X[hi], f);
  const far = lerp(FAR_LANE_X[lo], FAR_LANE_X[hi], f);
  return lerp(far, near, t) * cw;
}

function yAt(t) { return lerp(FAR_Y, NEAR_Y, t) * ch; }
function scaleAt(t) { return lerp(FAR_SCALE, NEAR_SCALE, t); }

function drawBackground(now) {
  const grad = ctx.createLinearGradient(0, 0, 0, ch);
  grad.addColorStop(0, "#1c212c");
  grad.addColorStop(0.35, "#141821");
  grad.addColorStop(1, "#0b0d11");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, cw, ch);
}

function drawRoad(now) {
  const horizonY = FAR_Y * ch;
  const nearY = NEAR_Y * ch;
  const nearLeft = NEAR_LANE_X[0] * cw - 34;
  const nearRight = NEAR_LANE_X[2] * cw + 34;
  const farLeft = FAR_LANE_X[0] * cw - 4;
  const farRight = FAR_LANE_X[2] * cw + 4;

  ctx.fillStyle = "#20242e";
  ctx.beginPath();
  ctx.moveTo(farLeft, horizonY);
  ctx.lineTo(farRight, horizonY);
  ctx.lineTo(nearRight, nearY);
  ctx.lineTo(nearLeft, nearY);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "rgba(232, 178, 61, 0.35)";
  ctx.lineWidth = 2;
  const dashOffset = (now / 12) % 40;
  ctx.setLineDash([16, 22]);
  ctx.lineDashOffset = -dashOffset;
  for (let lane = 1; lane < LANE_COUNT; lane++) {
    const fx = lerp(FAR_LANE_X[lane - 1], FAR_LANE_X[lane], 0.5) * cw;
    const nx = lerp(NEAR_LANE_X[lane - 1], NEAR_LANE_X[lane], 0.5) * cw;
    ctx.beginPath();
    ctx.moveTo(fx, horizonY);
    ctx.lineTo(nx, nearY);
    ctx.stroke();
  }
  ctx.setLineDash([]);
}

function drawEmoji(text, x, y, px) {
  ctx.font = `${px}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y);
}

function drawObstacle(ob) {
  const t = clamp(ob.progress, 0, 1.12);
  const x = laneXAt(ob.lane, t);
  const y = yAt(t);
  const scale = scaleAt(t);

  if (ob.type === "shop") {
    const rampT = clamp(ob.progress - 0.08, 0, 1.12);
    const rx = laneXAt(ob.lane, rampT);
    const ry = yAt(rampT);
    const rs = scaleAt(rampT) * 26;
    ctx.fillStyle = "#e8b23d";
    ctx.strokeStyle = "rgba(23, 19, 10, 0.5)";
    ctx.lineWidth = Math.max(1, rs * 0.06);
    ctx.beginPath();
    ctx.moveTo(rx - rs, ry + rs * 0.3);
    ctx.lineTo(rx + rs, ry + rs * 0.3);
    ctx.lineTo(rx + rs * 0.3, ry - rs * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    drawEmoji("🏪", x, y, 40 * scale + 10);
  } else {
    drawEmoji("🛢️", x, y, 34 * scale + 8);
  }
}

// --- player car: drawn from behind, facing down the road -------------
function shadeColor(hex, percent) {
  const num = parseInt(hex.slice(1), 16);
  const r = clamp((num >> 16) + Math.round(2.55 * percent), 0, 255);
  const g = clamp(((num >> 8) & 0xff) + Math.round(2.55 * percent), 0, 255);
  const b = clamp((num & 0xff) + Math.round(2.55 * percent), 0, 255);
  return `rgb(${r},${g},${b})`;
}

function drawRoundel(cx, cy, r) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = "#14171d";
  ctx.fill();
  const rr = r * 0.78;
  const colors = ["#eef1f5", "#1e5fb8", "#eef1f5", "#1e5fb8"];
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, rr, (Math.PI / 2) * i - Math.PI / 2, (Math.PI / 2) * (i + 1) - Math.PI / 2);
    ctx.closePath();
    ctx.fillStyle = colors[i];
    ctx.fill();
  }
  ctx.restore();
}

function drawTaillight(sx, dark) {
  // sx: -1 (left) or 1 (right). Drawn in local car-unit space.
  const style = world.model.tailShape;
  const outerX = sx * 26;
  if (style === "boxy") {
    // E30: one large rectangular unit wrapping the corner, banded.
    const w = 10, top = -27, h = 15;
    const x = sx > 0 ? outerX - w : outerX;
    ctx.fillStyle = "#3a2020";
    ctx.beginPath();
    ctx.roundRect(x, top, w, h, 1.5);
    ctx.fill();
    ctx.fillStyle = "#e8a23d";
    ctx.fillRect(x + 1, top + 1, w - 2, h * 0.28);
    ctx.fillStyle = "#e0272f";
    ctx.fillRect(x + 1, top + h * 0.32, w - 2, h * 0.46);
    ctx.fillStyle = "#cfd6e0";
    ctx.fillRect(x + 1, top + h * 0.82, w - 2, h * 0.14);
  } else if (style === "round") {
    const w = 9, top = -26, h = 13;
    const x = sx > 0 ? outerX - w : outerX;
    ctx.fillStyle = "#3a2020";
    ctx.beginPath();
    ctx.roundRect(x, top, w, h, 3.5);
    ctx.fill();
    ctx.fillStyle = "#e0272f";
    ctx.beginPath();
    ctx.roundRect(x + 1, top + 1, w - 2, h - 4, 2.5);
    ctx.fill();
    ctx.fillStyle = "#cfd6e0";
    ctx.fillRect(x + 1, top + h - 3.5, w - 2, 2.5);
  } else {
    // slim: modern LED light-bar sliver.
    const w = 12, top = -22, h = 4;
    const x = sx > 0 ? outerX - w + 4 : outerX - 4;
    ctx.fillStyle = "#e0272f";
    ctx.beginPath();
    ctx.roundRect(x, top, w, h, 2);
    ctx.fill();
  }
}

function drawCarRear(x, groundY, scale) {
  const model = world.model;
  const bodyColor = model.color;
  const bodyDark = shadeColor(bodyColor, -20);
  const bodyLight = shadeColor(bodyColor, 14);

  ctx.save();
  ctx.translate(x, groundY);
  ctx.scale(scale, scale);

  // rear bumper
  ctx.fillStyle = "#22262f";
  ctx.beginPath();
  ctx.roundRect(-30, -12, 60, 12, 4);
  ctx.fill();

  // exhaust tips
  ctx.fillStyle = "#111318";
  ctx.beginPath(); ctx.ellipse(-15, -3, 3.2, 2.1, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(15, -3, 3.2, 2.1, 0, 0, Math.PI * 2); ctx.fill();

  // lower body / quarter panels
  ctx.fillStyle = bodyColor;
  ctx.beginPath();
  ctx.moveTo(-29, -12);
  ctx.lineTo(29, -12);
  ctx.lineTo(23, -30);
  ctx.lineTo(-23, -30);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = bodyDark;
  ctx.fillRect(-29, -14, 58, 2.4);

  // taillights
  drawTaillight(-1, bodyDark);
  drawTaillight(1, bodyDark);

  // trunk line, plate, roundel
  ctx.strokeStyle = bodyDark;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(-19, -24); ctx.lineTo(19, -24); ctx.stroke();

  ctx.fillStyle = "#e9e6da";
  ctx.beginPath();
  ctx.roundRect(-9, -19.5, 18, 7, 1.5);
  ctx.fill();
  ctx.strokeStyle = "#9a9683";
  ctx.lineWidth = 0.6;
  ctx.stroke();

  drawRoundel(0, -27.5, 3.2);

  // greenhouse: C-pillars + rear window
  ctx.fillStyle = bodyDark;
  ctx.beginPath();
  ctx.moveTo(-23, -30); ctx.lineTo(23, -30); ctx.lineTo(17, -44); ctx.lineTo(-17, -44);
  ctx.closePath();
  ctx.fill();

  const glassGrad = ctx.createLinearGradient(0, -44, 0, -30);
  glassGrad.addColorStop(0, "#4b5568");
  glassGrad.addColorStop(1, "#171b22");
  ctx.fillStyle = glassGrad;
  ctx.beginPath();
  ctx.moveTo(-14, -31); ctx.lineTo(14, -31); ctx.lineTo(10, -42); ctx.lineTo(-10, -42);
  ctx.closePath();
  ctx.fill();

  // side mirrors (peeking around the C-pillars, hinting the 3/4 rear view)
  ctx.fillStyle = bodyDark;
  ctx.beginPath(); ctx.roundRect(-27, -34, 4, 3, 1); ctx.fill();
  ctx.beginPath(); ctx.roundRect(23, -34, 4, 3, 1); ctx.fill();

  // roof
  ctx.fillStyle = bodyLight;
  ctx.beginPath();
  ctx.roundRect(-17, -47, 34, 4, 2);
  ctx.fill();

  ctx.restore();
}

function drawPlayer(now) {
  const x = laneXAt(world.laneVisual, 1);
  const baseY = yAt(1);
  let jumpOffset = 0;
  if (world.jumping) {
    const p = clamp((now - world.jumpStart) / JUMP_MS, 0, 1);
    jumpOffset = Math.sin(Math.PI * p) * JUMP_HEIGHT;
  }
  ctx.fillStyle = `rgba(0,0,0,${world.jumping ? 0.18 : 0.32})`;
  ctx.beginPath();
  ctx.ellipse(x, baseY + 6, 26 - jumpOffset * 0.2, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  drawCarRear(x, baseY - jumpOffset, 1.15);
}

function drawToast(now) {
  if (now >= world.toastUntil) return;
  const alpha = clamp((world.toastUntil - now) / 200, 0, 1);
  ctx.save();
  ctx.globalAlpha = Math.min(1, alpha + 0.4);
  ctx.font = "600 15px -apple-system, sans-serif";
  ctx.textAlign = "center";
  const textW = ctx.measureText(world.toastText).width;
  const pad = 12;
  const boxW = textW + pad * 2;
  const boxY = 14;
  ctx.fillStyle = "rgba(11,13,17,0.82)";
  ctx.beginPath();
  ctx.roundRect(cw / 2 - boxW / 2, boxY, boxW, 30, 8);
  ctx.fill();
  ctx.fillStyle = "#eceef2";
  ctx.textBaseline = "middle";
  ctx.fillText(world.toastText, cw / 2, boxY + 15);
  ctx.restore();
}

function render(now) {
  if (cw === 0) return;
  ctx.clearRect(0, 0, cw, ch);
  drawBackground(now);
  drawRoad(now);
  if (world) {
    const sorted = [...world.obstacles].sort((a, b) => a.progress - b.progress);
    for (const ob of sorted) drawObstacle(ob);
    drawPlayer(now);
    drawToast(now);
    if (now < world.flashUntil) {
      ctx.fillStyle = "rgba(224, 39, 47, 0.22)";
      ctx.fillRect(0, 0, cw, ch);
    }
  }
}

function updateHud() {
  if (!world) return;
  el.oil.textContent = Math.floor(world.oil).toLocaleString();
  el.distance.textContent = Math.floor(world.distance).toLocaleString() + " mi";
  el.lives.textContent = "❤️".repeat(Math.max(0, world.lives)) + "🖤".repeat(Math.max(0, LIVES_MAX - world.lives));
  el.faults.textContent = world.faults;
  el.best.textContent = save.bestDistance.toLocaleString() + " mi";
}

// --- boot -----------------------------------------------------------
renderModelSelect();
initCanvas();
goIdle();
