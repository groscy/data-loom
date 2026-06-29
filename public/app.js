"use strict";

// ── DOM refs ──
const board = document.getElementById("board");
const edgesSvg = document.getElementById("edges");
const doneBand = document.getElementById("doneband");
const detail = document.getElementById("detail");
const detailBody = document.getElementById("detail-body");
const connDot = document.getElementById("conn-dot");
const connText = document.getElementById("conn-text");
const genEl = document.getElementById("gen");
const conflictsEl = document.getElementById("conflicts");
const reviewEl = document.getElementById("review");
const projectSelect = document.getElementById("project-select");
const themeToggle = document.getElementById("theme-toggle");
const topoNodes = document.getElementById("topo-nodes");
const spokesSvg = document.getElementById("spokes");

// ── client state ──
let projects = null;
let model = null;
let mcpModel = null;
let activeTab = "roadmap";
let scopeFilter = "all";
let selectedChange = null; // change name shown in the detail panel
let selectedServer = null; // server name shown in the detail panel
let nextUpNames = new Set(); // ready proposals in the earliest ready phase
let conflictedNames = new Set();
let doneCollapsed = true;
const liveOverride = new Map(); // server name -> transient liveness (e.g. "checking")

// ── roadmap graph geometry (fixed design canvas, 1180×600) ──
const G_MX = 150,
  G_W = 1180,
  N_HALF = 105,
  N_TOP = 58,
  V_SPACE = 170;

// ── theme ──
function applyTheme(t) {
  // t: "light" | "dark"  (light = blueprint-light default, dark = blueprint)
  if (t === "dark") document.documentElement.dataset.theme = "dark";
  else delete document.documentElement.dataset.theme;
  const light = t !== "dark";
  themeToggle.querySelector(".theme-icon").textContent = light ? "☾" : "☀";
  themeToggle.querySelector(".theme-label").textContent = light ? "dark" : "light";
  themeToggle.title = light ? "Switch to dark" : "Switch to light";
}
let theme = localStorage.getItem("dataloom-theme") === "dark" ? "dark" : "light";
applyTheme(theme);
themeToggle.addEventListener("click", () => {
  theme = theme === "dark" ? "light" : "dark";
  localStorage.setItem("dataloom-theme", theme);
  applyTheme(theme);
});

// ── tab switching (active state re-derived from `activeTab`) ──
function syncTabs() {
  for (const b of document.querySelectorAll(".tab[data-tab]")) b.classList.toggle("active", b.dataset.tab === activeTab);
  for (const v of document.querySelectorAll(".view")) v.classList.toggle("active", v.id === activeTab);
}
for (const btn of document.querySelectorAll(".tab[data-tab]")) {
  btn.addEventListener("click", () => {
    activeTab = btn.dataset.tab;
    closeDetail();
    syncTabs();
  });
}

// ── scope filter ──
for (const chip of document.querySelectorAll(".scope-chip[data-scope]")) {
  chip.addEventListener("click", () => {
    scopeFilter = chip.dataset.scope;
    for (const c of document.querySelectorAll(".scope-chip")) c.classList.toggle("active", c === chip);
    renderTopology();
  });
}

// ── project selection ──
projectSelect.addEventListener("change", async () => {
  const path = projectSelect.value;
  try {
    const res = await fetch(`/api/project/select?path=${encodeURIComponent(path)}`, { method: "POST" });
    if (!res.ok) renderProjects(projects);
  } catch (e) {
    console.error("project switch failed", e);
    renderProjects(projects);
  }
});

function setProjects(p) {
  projects = p;
  renderProjects(p);
  if (!p.current) {
    clearBoard();
    board.appendChild(el("div", "empty-state", "Select a project above to begin."));
    doneBand.classList.add("hidden");
    conflictsEl.classList.add("hidden");
    reviewEl.classList.add("hidden");
  }
}

function renderProjects(p) {
  if (!p) return;
  const placeholder = p.current ? "" : '<option value="" disabled selected>Select a project…</option>';
  projectSelect.innerHTML =
    placeholder +
    p.candidates
      .map((c) => `<option value="${escapeHtml(c.path)}"${c.path === p.current ? " selected" : ""}>${escapeHtml(c.name)}</option>`)
      .join("");
}

connect();

function connect() {
  const ws = new WebSocket(`ws://${location.host}`);
  ws.addEventListener("open", () => setConn(true));
  ws.addEventListener("close", () => {
    setConn(false);
    setTimeout(connect, 1500); // auto-reconnect
  });
  ws.addEventListener("message", (ev) => {
    try {
      const msg = JSON.parse(ev.data);
      if (msg.type === "model") render(msg.model);
      else if (msg.type === "mcp") setMcp(msg.mcp);
      else if (msg.type === "mcpServer") updateMcpServer(msg.server);
      else if (msg.type === "project") setProjects(msg.project);
    } catch (e) {
      console.error("bad message", e);
    }
  });
}

function setConn(live) {
  connDot.classList.toggle("live", live);
  connText.textContent = live ? "live" : "reconnecting…";
}

// ═══════════════ ROADMAP ═══════════════

function render(m) {
  model = m;
  if (selectedChange && !m.changes.some((c) => c.name === selectedChange)) closeDetail();
  genEl.textContent = m.generatedAt ? "· " + new Date(m.generatedAt).toLocaleTimeString() : "";
  conflictedNames = new Set((m.conflicts || []).flatMap((c) => c.changes));
  renderConflicts(m.conflicts || []);
  renderReview();
  // Recommended next = ready proposals in the earliest phase that has any.
  const ready = m.changes.filter((c) => !c.archived && c.readiness === "ready");
  const minPhase = ready.length ? Math.min(...ready.map((c) => c.phase)) : 0;
  nextUpNames = new Set(ready.filter((c) => c.phase === minPhase).map((c) => c.name));
  renderBoard();
  renderDoneBand();
}

function renderConflicts(conflicts) {
  conflictsEl.innerHTML = "";
  if (!conflicts.length) {
    conflictsEl.classList.add("hidden");
    return;
  }
  conflictsEl.classList.remove("hidden");
  conflictsEl.appendChild(el("span", "conflicts-mark", "⚠"));
  const body = el("div");
  body.appendChild(el("div", "conflicts-head", `${conflicts.length} ordering conflict${conflicts.length > 1 ? "s" : ""}`));
  for (const c of conflicts) body.appendChild(el("div", "conflict-item", c.description));
  conflictsEl.appendChild(body);
}

function renderReview() {
  reviewEl.innerHTML = "";
  const pending = model.changes.filter((c) => !c.archived && c.dependencyReview === "pending");
  const n = pending.length;
  if (!n) {
    reviewEl.classList.add("hidden");
    return;
  }
  reviewEl.classList.remove("hidden");
  reviewEl.appendChild(el("span", "review-badge", String(n)));
  const txt = el("span", "review-text");
  const subject = n > 1 ? "proposals need" : "proposal needs";
  txt.innerHTML = `${n} ${subject} dependency review — ask Claude to <b>weave</b> ${n > 1 ? "them" : "it"} via the data-loom MCP server.`;
  reviewEl.appendChild(txt);
}

function clearBoard() {
  for (const ch of [...board.children]) if (ch !== edgesSvg) ch.remove();
  edgesSvg.innerHTML = "";
}

function renderBoard() {
  clearBoard();
  if (!model) return;

  const open = model.changes.filter((c) => !c.archived);
  if (!open.length) {
    board.appendChild(el("div", "empty-state", "No active changes yet. Propose one to populate the roadmap."));
    return;
  }

  const phaseNums = [...new Set(open.map((c) => c.phase))].sort((a, b) => a - b);
  const span = (G_W - 2 * G_MX) / Math.max(phaseNums.length - 1, 1);
  const gx = (p) => G_MX + phaseNums.indexOf(p) * span;

  // Grow the canvas vertically so the tallest phase always fits (real projects
  // can stack many cards in one phase). CARD_BAND leaves headroom for the
  // tallest card plus the frame header and top/bottom margins.
  const CARD_BAND = 340;
  const maxN = Math.max(1, ...phaseNums.map((p) => open.filter((c) => c.phase === p).length));
  const canvasH = Math.max(600, (maxN - 1) * V_SPACE + CARD_BAND);
  const cy = canvasH / 2;
  board.style.height = canvasH + "px";
  edgesSvg.setAttribute("viewBox", `0 0 ${G_W} ${canvasH}`);

  // Phase-band frames (behind everything), sized to the canvas.
  phaseNums.forEach((p, i) => {
    const frame = el("div", "phase-frame");
    frame.style.left = gx(p) - 117 + "px";
    frame.style.height = canvasH - 80 + "px";
    const head = el("div", "phase-frame-head");
    head.appendChild(el("span", "phase-frame-title", "PHASE " + p));
    head.appendChild(el("span", "phase-frame-sub", i === 0 ? "ready" : i === phaseNums.length - 1 ? "final" : "blocked"));
    frame.appendChild(head);
    board.insertBefore(frame, edgesSvg);
  });

  // Proposal cards (computed positions), each phase's stack centered on the canvas.
  const pos = {};
  phaseNums.forEach((p) => {
    const items = open.filter((c) => c.phase === p);
    items.forEach((c, i) => {
      const x = gx(p);
      const y = cy + (i - (items.length - 1) / 2) * V_SPACE;
      pos[c.name] = { x, y };
      const card = renderCard(c);
      card.style.left = x - N_HALF + "px";
      card.style.top = y - N_TOP + "px";
      board.appendChild(card);
    });
  });

  drawEdges(open, pos);
}

function renderCard(c) {
  const card = el("div", "gcard" + (selectedChange === c.name ? " selected" : ""));
  const bar = el("div", "gcard-bar");
  bar.style.background = statusColor(c.status);
  card.appendChild(bar);

  const body = el("div", "gcard-body");
  body.appendChild(el("div", "gcard-name", c.name));

  const pills = el("div", "gcard-pills");
  const sp = el("span", "gpill", c.status);
  sp.style.color = statusColor(c.status);
  pills.appendChild(sp);
  if (c.readiness === "ready") pills.appendChild(el("span", "gpill ready", "ready"));
  if (c.dependencyReview === "pending") pills.appendChild(el("span", "gpill review", "review?"));
  body.appendChild(pills);

  if (c.readiness === "blocked" && c.dependsOn.length) {
    body.appendChild(el("div", "gcard-waiting", "⏳ waiting on " + c.dependsOn.join(", ")));
  }

  const capsParts = [];
  if (c.newCapabilities.length) capsParts.push(`+${c.newCapabilities.length} new`);
  if (c.modifiedCapabilities.length) capsParts.push(`~${c.modifiedCapabilities.length} mod`);
  if (capsParts.length || c.totalTasks > 0) {
    const tasks = c.totalTasks > 0 ? `${c.completedTasks}/${c.totalTasks} tasks` : "";
    const text = [capsParts.join("  "), tasks].filter(Boolean).join(" · ");
    body.appendChild(el("div", "gcard-caps", text));
  }
  card.appendChild(body);

  if (nextUpNames.has(c.name)) card.appendChild(el("div", "gcard-next", "NEXT UP"));

  card.addEventListener("click", () => selectChange(c));
  return card;
}

function drawEdges(open, pos) {
  let s =
    '<defs><marker id="dep-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">' +
    '<path d="M1 1L8 5L1 9" fill="none" stroke="var(--edge)" stroke-width="1.6"/></marker></defs>';
  for (const c of open) {
    for (const dep of c.dependsOn) {
      const a = pos[dep];
      const b = pos[c.name];
      if (!a || !b) continue;
      const x1 = a.x + N_HALF,
        y1 = a.y,
        x2 = b.x - N_HALF,
        y2 = b.y,
        mx = (x1 + x2) / 2;
      s += `<path d="M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}" fill="none" stroke="var(--edge)" stroke-width="1.6" stroke-dasharray="5 4" marker-end="url(#dep-arrow)"/>`;
    }
  }
  edgesSvg.innerHTML = s;
}

function renderDoneBand() {
  const archived = model.changes.filter((c) => c.archived);
  if (!archived.length) {
    doneBand.classList.add("hidden");
    return;
  }
  doneBand.classList.remove("hidden");
  doneBand.innerHTML = "";
  const head = el("div", "doneband-head", `${doneCollapsed ? "▸" : "▾"} archived — ${archived.length} done`);
  head.addEventListener("click", () => {
    doneCollapsed = !doneCollapsed;
    renderDoneBand();
  });
  doneBand.appendChild(head);
  const items = el("div", "doneband-items" + (doneCollapsed ? " collapsed" : ""));
  for (const c of archived) {
    const chip = el("div", "done-chip", c.name);
    chip.addEventListener("click", () => selectChange(c));
    items.appendChild(chip);
  }
  doneBand.appendChild(items);
}

// ═══════════════ MCP TOPOLOGY (circuit board) ═══════════════

function setMcp(m) {
  mcpModel = m;
  if (selectedServer && !m.servers.some((s) => s.name === selectedServer)) closeDetail();
  renderTopology();
  if (selectedServer) renderServerDetail();
}

function updateMcpServer(server) {
  if (!mcpModel) return;
  liveOverride.delete(server.name); // real result arrived — drop transient state
  const i = mcpModel.servers.findIndex((s) => s.name === server.name);
  if (i >= 0) mcpModel.servers[i] = server;
  else mcpModel.servers.push(server);
  renderTopology();
  if (selectedServer === server.name) renderServerDetail();
}

function liveOf(s) {
  return liveOverride.get(s.name) || s.liveness;
}
function visibleServers() {
  if (!mcpModel) return [];
  return scopeFilter === "all" ? mcpModel.servers : mcpModel.servers.filter((s) => s.scope === scopeFilter);
}

function clearTopo() {
  for (const ch of [...topoNodes.children]) if (ch !== spokesSvg) ch.remove();
  spokesSvg.innerHTML = "";
}

function renderTopology() {
  if (!mcpModel) return;
  clearTopo();

  // MCU chip (hub).
  const mcu = el("div", "mcu");
  mcu.appendChild(el("div", "mcu-name", mcpModel.hub || "Claude Code"));
  mcu.appendChild(el("div", "mcu-sub", "MCU · hub"));
  topoNodes.appendChild(mcu);

  const vis = visibleServers();
  if (!vis.length) {
    topoNodes.appendChild(
      el("div", "topo-empty", mcpModel.servers.length ? "No servers match this scope." : "No MCP servers found in your Claude Code config.")
    );
    return;
  }

  const PCB_CX = 600,
    PCB_CY = 320,
    CHW = 152;
  const half = Math.ceil(vis.length / 2);
  const leftBank = vis.slice(0, half);
  const rightBank = vis.slice(half);
  const pinSp = (n) => Math.min(26, 120 / Math.max(n, 1));
  const yOf = (n, i, top, bot) => (n <= 1 ? (top + bot) / 2 : top + i * ((bot - top) / (n - 1)));
  const lineFor = (sc) => (sc === "global" ? "var(--line-a)" : "var(--line-b)");
  const liveUp = (s) => ["available", "already-running"].includes(liveOf(s));

  const traces = [];

  leftBank.forEach((s, i) => {
    const yc = yOf(leftBank.length, i, 72, 568),
      padX = 346;
    const pinY = PCB_CY + (i - (leftBank.length - 1) / 2) * pinSp(leftBank.length),
      sx = PCB_CX - CHW / 2,
      midX = 452 - i * 22;
    placeComp(s, 150, yc - 28);
    traces.push({ d: `M ${sx} ${pinY} H ${midX} V ${yc} H ${padX}`, color: lineFor(s.scope), dash: s.scope === "project", flow: liveUp(s), px: sx, py: pinY, qx: padX, qy: yc });
  });
  rightBank.forEach((s, i) => {
    const yc = yOf(rightBank.length, i, 72, 568),
      padX = 854;
    const pinY = PCB_CY + (i - (rightBank.length - 1) / 2) * pinSp(rightBank.length),
      ex = PCB_CX + CHW / 2,
      midX = 748 + i * 22;
    placeComp(s, 854, yc - 28);
    traces.push({ d: `M ${ex} ${pinY} H ${midX} V ${yc} H ${padX}`, color: lineFor(s.scope), dash: s.scope === "project", flow: liveUp(s), px: ex, py: pinY, qx: padX, qy: yc });
  });

  drawTraces(traces);
}

function placeComp(s, left, top) {
  const comp = el("div", "pcb-comp" + (selectedServer === s.name ? " selected" : ""));
  comp.style.left = left + "px";
  comp.style.top = top + "px";

  const topRow = el("div", "pcb-comp-top");
  const led = el("span", "pcb-led");
  const color = livenessColor(liveOf(s));
  led.style.background = color;
  led.style.boxShadow = "0 0 6px " + color;
  topRow.appendChild(led);
  topRow.appendChild(el("span", "pcb-comp-name", s.name));
  comp.appendChild(topRow);
  comp.appendChild(el("div", "pcb-comp-sub", `${s.transport} · ${s.scope} · ${livenessLabel(liveOf(s))}`));

  comp.addEventListener("click", () => selectServer(s));
  topoNodes.appendChild(comp);
}

function drawTraces(traces) {
  let s = "";
  // base traces + solder pads
  for (const t of traces) {
    s += `<path d="${t.d}" fill="none" stroke="${t.color}" stroke-width="2"${t.dash ? ' stroke-dasharray="5 4"' : ""} opacity="0.45"/>`;
    s += `<circle cx="${t.px}" cy="${t.py}" r="3.5" fill="${t.color}"/>`;
    s += `<circle cx="${t.qx}" cy="${t.qy}" r="3.5" fill="${t.color}"/>`;
  }
  // live traffic pulse on reachable links
  for (const t of traces) {
    if (t.flow) s += `<path d="${t.d}" fill="none" stroke="${t.color}" stroke-width="2.4" stroke-dasharray="2 13" style="animation:lm-dash 1s linear infinite"/>`;
  }
  spokesSvg.innerHTML = s;
}

async function triggerCheck(name) {
  liveOverride.set(name, "checking");
  renderTopology();
  if (selectedServer === name) renderServerDetail();
  try {
    await fetch(`/api/mcp/check?name=${encodeURIComponent(name)}`, { method: "POST" });
    // result arrives via the ws 'mcpServer' push -> updateMcpServer re-renders
  } catch (e) {
    console.error("check failed", e);
    liveOverride.delete(name);
    renderTopology();
  }
}

// ═══════════════ DETAIL PANELS ═══════════════

function selectChange(c) {
  if (selectedChange === c.name) {
    closeDetail();
    return;
  }
  selectedChange = c.name;
  selectedServer = null;
  renderChangeDetail(c);
  renderBoard();
}

function selectServer(s) {
  if (selectedServer === s.name) {
    closeDetail();
    return;
  }
  selectedServer = s.name;
  selectedChange = null;
  renderServerDetail();
  renderTopology();
}

function closeDetail() {
  detail.classList.add("hidden");
  const reChange = selectedChange != null;
  const reServer = selectedServer != null;
  selectedChange = null;
  selectedServer = null;
  if (reChange && model) renderBoard();
  if (reServer && mcpModel) renderTopology();
}

function openPanel(server) {
  detail.classList.remove("hidden");
  detail.classList.toggle("server", !!server);
  // re-trigger slide-in animation
  detail.style.animation = "none";
  void detail.offsetWidth;
  detail.style.animation = "";
}

function detailHeader(name) {
  const head = el("div", "detail-head");
  head.appendChild(el("div", "detail-name", name));
  const close = el("button", "detail-close", "×");
  close.addEventListener("click", closeDetail);
  head.appendChild(close);
  return head;
}

function renderChangeDetail(c) {
  openPanel(false);
  detailBody.innerHTML = "";
  const inner = el("div", "detail-inner");
  inner.appendChild(detailHeader(c.name));

  const pills = el("div", "detail-pills");
  const sp = el("span", "detail-pill", c.status);
  sp.style.color = statusColor(c.status);
  pills.appendChild(sp);
  pills.appendChild(el("span", "detail-pill", c.archived ? "archived" : "phase " + c.phase));
  const rp = el("span", "detail-pill", c.readiness);
  rp.style.color = "var(--accent)";
  pills.appendChild(rp);
  inner.appendChild(pills);

  if (c.totalTasks > 0) {
    const pct = Math.round((c.completedTasks / c.totalTasks) * 100);
    const tasks = el("div", "detail-tasks");
    const row = el("div", "detail-tasks-row");
    row.appendChild(el("span", null, "tasks"));
    row.appendChild(el("span", null, `${c.completedTasks}/${c.totalTasks} · ${pct}%`));
    tasks.appendChild(row);
    const track = el("div", "detail-tasks-track");
    const fill = el("div", "detail-tasks-fill");
    fill.style.width = pct + "%";
    track.appendChild(fill);
    tasks.appendChild(track);
    inner.appendChild(tasks);
  }

  inner.appendChild(el("div", "detail-section first", "Depends on"));
  if (c.dependsOn.length) inner.appendChild(itemList(c.dependsOn));
  else inner.appendChild(el("div", "detail-none", "— independent —"));

  inner.appendChild(el("div", "detail-section", "New capabilities"));
  if (c.newCapabilities.length) inner.appendChild(itemList(c.newCapabilities, "add", "+ "));
  else inner.appendChild(el("div", "detail-none", "—"));

  if (c.modifiedCapabilities.length) {
    inner.appendChild(el("div", "detail-section", "Modified capabilities"));
    inner.appendChild(itemList(c.modifiedCapabilities, "mod", "~ "));
  }
  if (c.unsatisfiedDependencies.length) {
    inner.appendChild(el("div", "detail-section warn", "⚠ Unsatisfied"));
    inner.appendChild(itemList(c.unsatisfiedDependencies, "unsat"));
  }

  detailBody.appendChild(inner);
}

function renderServerDetail() {
  const s = mcpModel && mcpModel.servers.find((x) => x.name === selectedServer);
  if (!s) return;
  openPanel(true);
  detailBody.innerHTML = "";
  const inner = el("div", "detail-inner");
  inner.appendChild(detailHeader(s.name));

  const lv = liveOf(s);
  const live = el("div", "detail-live");
  const dot = el("span", "detail-live-dot");
  const color = livenessColor(lv);
  dot.style.background = color;
  dot.style.boxShadow = "0 0 8px " + color;
  live.appendChild(dot);
  live.appendChild(el("span", "detail-live-label", livenessLabel(lv)));
  inner.appendChild(live);

  const rows = el("div", "detail-rows");
  rows.appendChild(detailRow("transport", s.transport));
  rows.appendChild(detailRow("scope", s.scope));
  rows.appendChild(detailRow("source", s.detail || s.source || "—"));
  inner.appendChild(rows);

  const btn = el("button", "detail-check", "check availability");
  btn.addEventListener("click", () => triggerCheck(s.name));
  inner.appendChild(btn);

  inner.appendChild(
    el("p", "detail-note", "Passive probe only — DataLoom never starts a server. It reports what's reachable so you know what to launch yourself.")
  );

  detailBody.appendChild(inner);
}

function detailRow(k, v) {
  const row = el("div", "detail-row");
  row.appendChild(el("span", "k", k));
  row.appendChild(el("span", "v", v));
  return row;
}

function itemList(items, cls, prefix) {
  const list = el("div", "detail-list");
  for (const it of items) list.appendChild(el("span", "detail-item" + (cls ? " " + cls : ""), (prefix || "") + it));
  return list;
}

// ═══════════════ helpers ═══════════════

function statusColor(status) {
  return status === "in-progress" ? "var(--c-progress)" : status === "done" ? "var(--c-done)" : "var(--c-draft)";
}

function livenessColor(l) {
  return (
    {
      available: "var(--c-done)",
      "already-running": "var(--c-done)",
      "needs-auth": "var(--c-progress)",
      unreachable: "var(--c-warn)",
      "on-demand": "var(--accent)",
      checking: "var(--c-progress)",
      unknown: "var(--muted)",
    }[l] || "var(--muted)"
  );
}

function livenessLabel(l) {
  return (
    {
      unknown: "unknown",
      checking: "checking…",
      available: "available",
      "needs-auth": "needs auth",
      unreachable: "unreachable",
      "on-demand": "on-demand",
      "already-running": "running",
    }[l] || l
  );
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}
