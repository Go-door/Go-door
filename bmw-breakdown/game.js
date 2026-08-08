// BMW Breakdown — a game about keeping a car that hates you alive.

const SAVE_KEY = "bmwBreakdownSave";

const MODELS = [
  {
    id: "e30",
    name: "E30 \"The Beater\"",
    emoji: "🚙",
    unlockAt: 0,
    cashPerDrive: 3,
    breakdownMin: 22,
    breakdownMax: 38,
    repairBase: 35,
    repairWindow: 14,
    blurb: "Held together with duct tape and hope.",
  },
  {
    id: "e46",
    name: "E46 \"The Sweet Spot\"",
    emoji: "🚗",
    unlockAt: 400,
    cashPerDrive: 6,
    breakdownMin: 16,
    breakdownMax: 28,
    repairBase: 65,
    repairWindow: 12,
    blurb: "Everyone's favorite. Still finds new ways to die.",
  },
  {
    id: "f30",
    name: "F30 \"The Lease Special\"",
    emoji: "🚘",
    unlockAt: 1500,
    cashPerDrive: 10,
    breakdownMin: 11,
    breakdownMax: 19,
    repairBase: 120,
    repairWindow: 10,
    blurb: "Turbo lag, run-flats, and a dealer on speed dial.",
  },
  {
    id: "g20",
    name: "G20 \"iDrive Nightmare\"",
    emoji: "🏎️",
    unlockAt: 4000,
    cashPerDrive: 18,
    breakdownMin: 7,
    breakdownMax: 13,
    repairBase: 220,
    repairWindow: 8,
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
  "The sunroof opened itself. It's raining.",
  "Timing chain stretched like your patience.",
  "VANOS solenoid filed for divorce.",
  "Window regulator gave up mid-descent.",
  "The infamous BMW death rattle has returned.",
  "Oil leak has formed its own ecosystem underneath.",
  "Battery drained itself out of spite overnight.",
  "Plastic coolant flange did what plastic coolant flanges do.",
  "The \"Service Engine Soon\" light is now just always on.",
];

const GAMEOVER_QUOTES = [
  "\"It's a great car when it runs.\" — everyone, always",
  "You have been visited by the Bavarian Breakdown Fairy.",
  "The dealership sends their regards, and an invoice.",
  "Somewhere, a mechanic just bought a boat.",
  "It wasn't the miles. It was the years. And the miles.",
  "RIP. Cause of death: German engineering.",
];

let state = null;
let save = loadSave();

const el = {
  cash: document.getElementById("cash"),
  distance: document.getElementById("distance"),
  survived: document.getElementById("survived"),
  fixed: document.getElementById("fixed"),
  best: document.getElementById("best"),
  car: document.getElementById("car"),
  smoke: document.getElementById("smoke"),
  warning: document.getElementById("warning"),
  driveBtn: document.getElementById("drive-btn"),
  breakdownPanel: document.getElementById("breakdown-panel"),
  breakdownReason: document.getElementById("breakdown-reason"),
  repairBtn: document.getElementById("repair-btn"),
  repairCost: document.getElementById("repair-cost"),
  timerBar: document.getElementById("timer-bar"),
  modelSelect: document.getElementById("model-select"),
  gameover: document.getElementById("gameover"),
  gameoverStats: document.getElementById("gameover-stats"),
  gameoverQuote: document.getElementById("gameover-quote"),
  restartBtn: document.getElementById("restart-btn"),
};

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    /* localStorage unavailable, ignore */
  }
  return { lifetimeCash: 0, bestTime: 0, selectedModel: "e30" };
}

function persistSave() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch (e) {
    /* ignore */
  }
}

function fmtMoney(n) {
  return "$" + Math.floor(n).toLocaleString();
}

function fmtTime(s) {
  return Math.floor(s) + "s";
}

function pickModel(id) {
  const model = MODELS.find((m) => m.id === id) || MODELS[0];
  if (save.lifetimeCash < model.unlockAt) return;
  save.selectedModel = model.id;
  persistSave();
  renderModelSelect();
  resetGame();
}

function renderModelSelect() {
  el.modelSelect.innerHTML = "";
  MODELS.forEach((m) => {
    const unlocked = save.lifetimeCash >= m.unlockAt;
    const btn = document.createElement("button");
    btn.className = "model-btn" + (m.id === save.selectedModel ? " active" : "");
    btn.disabled = !unlocked;
    btn.innerHTML = `${m.emoji} ${m.name}<small>${unlocked ? m.blurb : "Unlocks at " + fmtMoney(m.unlockAt) + " lifetime"}</small>`;
    btn.addEventListener("click", () => pickModel(m.id));
    el.modelSelect.appendChild(btn);
  });
}

function currentModel() {
  return MODELS.find((m) => m.id === save.selectedModel) || MODELS[0];
}

function resetGame() {
  clearTimers();
  const model = currentModel();
  state = {
    cash: 0,
    distance: 0,
    survivedStart: performance.now(),
    fixedCount: 0,
    broken: false,
    dead: false,
    breakdownTimeoutId: null,
    repairIntervalId: null,
    repairDeadline: 0,
    repairCost: 0,
    surviveTickId: null,
  };
  el.gameover.classList.add("hidden");
  el.breakdownPanel.classList.add("hidden");
  el.warning.classList.add("hidden");
  el.smoke.classList.add("hidden");
  el.car.textContent = model.emoji;
  el.car.className = "car ok";
  el.driveBtn.disabled = false;
  updateStatsDisplay();
  scheduleBreakdown();
  state.surviveTickId = setInterval(() => {
    updateStatsDisplay();
  }, 200);
}

function clearTimers() {
  if (state) {
    if (state.breakdownTimeoutId) clearTimeout(state.breakdownTimeoutId);
    if (state.repairIntervalId) clearInterval(state.repairIntervalId);
    if (state.surviveTickId) clearInterval(state.surviveTickId);
  }
}

function survivedSeconds() {
  return (performance.now() - state.survivedStart) / 1000;
}

function scheduleBreakdown() {
  const model = currentModel();
  // Difficulty ramps up the longer you survive: breakdowns get more frequent.
  const survived = survivedSeconds();
  const rampFactor = Math.max(0.45, 1 - survived / 240);
  const min = model.breakdownMin * rampFactor;
  const max = model.breakdownMax * rampFactor;
  const delay = (min + Math.random() * (max - min)) * 1000;
  state.breakdownTimeoutId = setTimeout(triggerBreakdown, delay);
}

function triggerBreakdown() {
  if (!state || state.dead) return;
  const model = currentModel();
  state.broken = true;
  el.car.className = "car broken";
  el.smoke.classList.remove("hidden");
  el.warning.classList.remove("hidden");
  el.driveBtn.disabled = true;

  const reason = BREAKDOWN_REASONS[Math.floor(Math.random() * BREAKDOWN_REASONS.length)];
  el.breakdownReason.textContent = reason;

  const growth = 1 + state.fixedCount * 0.28;
  const jitter = 0.85 + Math.random() * 0.4;
  state.repairCost = Math.round(model.repairBase * growth * jitter);
  el.repairCost.textContent = state.repairCost.toLocaleString();

  const survived = survivedSeconds();
  const rampFactor = Math.max(0.5, 1 - survived / 300);
  const windowSeconds = Math.max(4, model.repairWindow * rampFactor);
  state.repairDeadline = performance.now() + windowSeconds * 1000;

  el.breakdownPanel.classList.remove("hidden");
  updateRepairButton();

  state.repairIntervalId = setInterval(() => {
    const remaining = state.repairDeadline - performance.now();
    const pct = Math.max(0, remaining / (windowSeconds * 1000)) * 100;
    el.timerBar.style.width = pct + "%";
    updateRepairButton();
    if (remaining <= 0) {
      clearInterval(state.repairIntervalId);
      killCar();
    }
  }, 100);
}

function updateRepairButton() {
  el.repairBtn.disabled = state.cash < state.repairCost;
}

function repairCar() {
  if (!state || !state.broken || state.cash < state.repairCost) return;
  state.cash -= state.repairCost;
  state.fixedCount += 1;
  state.broken = false;
  clearInterval(state.repairIntervalId);
  el.breakdownPanel.classList.add("hidden");
  el.warning.classList.add("hidden");
  el.smoke.classList.add("hidden");
  el.car.className = "car ok";
  el.driveBtn.disabled = false;
  updateStatsDisplay();
  scheduleBreakdown();
}

function killCar() {
  state.dead = true;
  clearTimers();
  el.car.className = "car broken";
  el.breakdownPanel.classList.add("hidden");

  const survived = survivedSeconds();
  save.lifetimeCash += state.cash; // spent cash was already deducted; add what's left over
  if (survived > save.bestTime) save.bestTime = survived;
  persistSave();
  renderModelSelect();

  el.gameoverStats.textContent = `You drove ${Math.floor(state.distance).toLocaleString()} miles, survived ${fmtTime(survived)}, and fixed it ${state.fixedCount} time${state.fixedCount === 1 ? "" : "s"} before it finally gave up.`;
  el.gameoverQuote.textContent = GAMEOVER_QUOTES[Math.floor(Math.random() * GAMEOVER_QUOTES.length)];
  el.gameover.classList.remove("hidden");
  el.best.textContent = fmtTime(save.bestTime);
}

function drive() {
  if (!state || state.broken || state.dead) return;
  const model = currentModel();
  const gain = model.cashPerDrive * (0.8 + Math.random() * 0.4);
  state.cash += gain;
  state.distance += 1 + Math.random() * 2;
  el.car.classList.add("driving");
  setTimeout(() => el.car.classList.remove("driving"), 150);
  updateStatsDisplay();
}

function updateStatsDisplay() {
  if (!state) return;
  el.cash.textContent = fmtMoney(state.cash);
  el.distance.textContent = Math.floor(state.distance).toLocaleString() + " mi";
  el.survived.textContent = fmtTime(state.dead ? 0 : survivedSeconds());
  el.fixed.textContent = state.fixedCount;
  el.best.textContent = fmtTime(save.bestTime);
  if (state.broken) updateRepairButton();
}

el.driveBtn.addEventListener("click", drive);
el.repairBtn.addEventListener("click", repairCar);
el.restartBtn.addEventListener("click", resetGame);

renderModelSelect();
resetGame();
