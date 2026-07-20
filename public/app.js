"use strict";

// ── DOM refs ──
const board = document.getElementById("board");
const boardWrap = document.getElementById("board-wrap");
const edgesSvg = document.getElementById("edges");
const minimap = document.getElementById("minimap");
const minimapSvg = document.getElementById("minimap-svg");
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
const topoWrap = document.getElementById("topo-wrap");
const spokesSvg = document.getElementById("spokes");
const topoMinimap = document.getElementById("topo-minimap");
const topoMinimapSvg = document.getElementById("topo-minimap-svg");
const atlasBody = document.getElementById("atlas-body");

// ── client state ──
let projects = null;
let model = null;
let atlas = null;
let atlasSeenBaseline = null; // ms cursor: "changed since" is measured against this
let mcpModel = null;
let activeTab = "roadmap";
let scopeFilter = "all";
let selectedChange = null; // change name shown in the detail panel
let selectedServer = null; // server name shown in the detail panel
let nextUpNames = new Set(); // ready proposals in the earliest ready phase
let conflictedNames = new Set();
const liveOverride = new Map(); // server name -> transient liveness (e.g. "checking")

// ── roadmap graph geometry (fixed left/right margin + fixed per-phase pitch) ──
const G_MX = 150,
  PHASE_SPAN = 260, // horizontal pitch between phase columns (234px frame + gutter)
  N_HALF = 105,
  N_TOP = 58,
  V_SPACE = 170;

// ── canvas navigation (shared by the roadmap and MCP topology boards) ──
// Each board is one composited layer carrying translate+scale, so its nodes and
// its SVG overlay pan and zoom together and connectors stay anchored for free.
// The state lives in the controller closure, outside any DOM the view tears down,
// which is what lets a viewport survive a re-render.
const MIN_K = 0.25, // below this nodes are structure, not text — that's the minimap's job
  MAX_K = 2,
  ZOOM_STEP = 1.2, // per button press / key press
  PAN_KEEP = 80, // px of canvas that must stay inside the viewport on every edge
  MM_MAX_W = 190, // minimap box caps
  MM_MAX_H = 130;
let phaseCount = 0; // roadmap: phase columns last rendered — drives its minimap rule
let boardMinimapData = { open: [], pos: {}, frames: [] }; // what the roadmap minimap draws

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
    const prev = activeTab;
    activeTab = btn.dataset.tab;
    closeDetail();
    syncTabs();
    // Entering the atlas captures the "since last visit" baseline and advances
    // the persisted cursor, so this visit's marks clear on the next one.
    if (activeTab === "atlas" && prev !== "atlas") {
      enterAtlas();
      renderAtlas();
    }
    // A canvas board that first rendered while its tab was hidden measured a 0×0
    // viewport, so it is neither fitted nor able to judge its minimap. syncTabs()
    // has already made it visible, so it can settle both now.
    if (activeTab === "roadmap" && prev !== "roadmap") roadmapCanvas.revalidate();
    if (activeTab === "topology" && prev !== "topology") topologyCanvas.revalidate();
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
  // A different project opens both boards fitted; a live push for the same
  // project keeps the reader's pan and zoom. This is the only thing that tells
  // them apart.
  if (!projects || projects.current !== p.current) {
    roadmapCanvas.markUnfitted();
    topologyCanvas.markUnfitted();
  }
  projects = p;
  renderProjects(p);
  if (!p.current) {
    clearBoard();
    board.appendChild(el("div", "empty-state", "Select a project above to begin."));
    phaseCount = 0;
    roadmapCanvas.reset();
    conflictsEl.classList.add("hidden");
    reviewEl.classList.add("hidden");
    atlas = null;
    renderAtlas();
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
      else if (msg.type === "atlas") setAtlas(msg.atlas);
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
  // Keep an open change-detail panel in sync with the freshly pushed model, so
  // task-list / progress edits live-update without re-selecting the node.
  if (selectedChange) {
    const c = m.changes.find((x) => x.name === selectedChange);
    if (c) renderChangeDetail(c);
  }
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
  txt.innerHTML = `${n} ${subject} dependency review — copy the <b>weave</b> command to run it in Claude Code.`;
  reviewEl.appendChild(txt);
  const btn = el("button", "banner-action", "Weave");
  btn.title = "Copy /loom:weave";
  btn.addEventListener("click", () => copyCommand("/loom:weave"));
  reviewEl.appendChild(btn);
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
    // Nothing to navigate: match the canvas to the viewport and drop any
    // transform, so the absolutely-centered empty state lands where it belongs.
    phaseCount = 0;
    roadmapCanvas.reset();
    return;
  }

  const phaseNums = [...new Set(open.map((c) => c.phase))].sort((a, b) => a - b);
  // Fixed per-phase pitch → the canvas grows wider as phases are added instead of
  // squeezing columns into a constant width. Wide plans are then reached by
  // panning the canvas (see the viewport section) rather than overlapping.
  const canvasW = 2 * G_MX + Math.max(phaseNums.length - 1, 0) * PHASE_SPAN;
  const gx = (p) => G_MX + phaseNums.indexOf(p) * PHASE_SPAN;

  // Grow the canvas vertically so the tallest phase always fits (real projects
  // can stack many cards in one phase). CARD_BAND leaves headroom for the
  // tallest card plus the frame header and top/bottom margins.
  const CARD_BAND = 340;
  const maxN = Math.max(1, ...phaseNums.map((p) => open.filter((c) => c.phase === p).length));
  const canvasH = Math.max(600, (maxN - 1) * V_SPACE + CARD_BAND);
  phaseCount = phaseNums.length;
  const cy = canvasH / 2;
  board.style.width = canvasW + "px";
  board.style.height = canvasH + "px";
  edgesSvg.setAttribute("viewBox", `0 0 ${canvasW} ${canvasH}`);
  roadmapCanvas.setCanvasSize(canvasW, canvasH);

  // Phase-band frames (behind everything), sized to the canvas.
  const frames = [];
  phaseNums.forEach((p, i) => {
    const frame = el("div", "phase-frame");
    frame.style.left = gx(p) - 117 + "px";
    frame.style.height = canvasH - 80 + "px";
    frames.push({ x: gx(p) - 117, y: 40, w: 234, h: canvasH - 80 });
    const head = el("div", "phase-frame-head");
    head.appendChild(el("span", "phase-frame-title", "PHASE " + p));
    head.appendChild(el("span", "phase-frame-sub", i === 0 ? "ready" : i === phaseNums.length - 1 ? "final" : "blocked"));
    frame.appendChild(head);
    board.insertBefore(frame, edgesSvg);
  });

  // Proposal cards (computed positions), each phase's stack centered on the canvas.
  const pos = {};
  const placed = [];
  phaseNums.forEach((p) => {
    const items = open.filter((c) => c.phase === p);
    items.forEach((c, i) => {
      const x = gx(p);
      const y = cy + (i - (items.length - 1) / 2) * V_SPACE;
      pos[c.name] = { x, y, top: y - N_TOP, h: 2 * N_TOP, cy: y };
      const card = renderCard(c);
      card.style.left = x - N_HALF + "px";
      card.style.top = y - N_TOP + "px";
      board.appendChild(card);
      placed.push({ name: c.name, card });
    });
  });

  // A card's height follows its content — a "waiting on" line, an action button or
  // a NEXT UP badge each make it taller — so the layout anchor `y` is not where the
  // card visually centers. Measure now that they are in the DOM and let connectors
  // and the minimap use the real box. Reads are batched with no interleaved writes,
  // so this costs one layout pass, not one per card.
  for (const { name, card } of placed) {
    const h = card.offsetHeight || 2 * N_TOP; // 0 while the roadmap tab is display:none
    pos[name].h = h;
    pos[name].cy = pos[name].top + h / 2;
  }

  drawEdges(open, pos);
  boardMinimapData = { open, pos, frames };
  roadmapCanvas.renderMinimap();
  // First render of a project fits the whole plan; every later render (a model
  // push, a selection, closing the detail panel) keeps the reader's place.
  roadmapCanvas.settle();
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
  const action = changeAction(c);
  if (action) {
    const btn = el("button", "card-action " + action.kind, action.label);
    btn.title = "Copy " + action.command;
    btn.addEventListener("click", (ev) => {
      ev.stopPropagation(); // copy only — don't also select the card / open detail
      copyCommand(action.command);
    });
    body.appendChild(btn);
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
      // Anchor to each card's measured centre, not its layout anchor, so a
      // connector meets the card edge where the eye expects it.
      const x1 = a.x + N_HALF,
        y1 = a.cy,
        x2 = b.x - N_HALF,
        y2 = b.cy,
        mx = (x1 + x2) / 2;
      s += `<path d="M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}" fill="none" stroke="var(--edge)" stroke-width="1.6" stroke-dasharray="5 4" marker-end="url(#dep-arrow)"/>`;
    }
  }
  edgesSvg.innerHTML = s;
}

// ═══════════════ CANVAS CONTROLLER: pan, zoom, minimap ═══════════════
// Shared by the roadmap and the MCP topology. The viewport clips; the canvas
// moves. The layer carries one translate+scale, so every child — cards, frames,
// the SVG overlay — transforms together and connectors stay anchored to their
// nodes without any recomputation.
//
// Two things are irreducibly per-view and arrive as callbacks: what the minimap
// draws, and when it is worth showing. Everything else is identical, so the two
// views cannot drift apart.
//
//   viewport            the clipping element (also the focus + gesture target)
//   canvas              the transformed layer inside it
//   minimap/minimapSvg  the overview box and its SVG
//   drawMinimapContent  () => SVG string, in canvas coordinates
//   shouldShowMinimap   (cw, ch, vw, vh) => boolean
//   dragIgnoreSelector  descendants that own their own pointer gestures
//   onReveal            optional: called instead of a plain fit when the viewport
//                       gains a real size while still unfitted (a view that
//                       measures its DOM needs a full re-render, not just a fit)
function createCanvasController(opts) {
  const { viewport, canvas, minimap, minimapSvg, drawMinimapContent, shouldShowMinimap, dragIgnoreSelector, onReveal } = opts;

  let view = { x: 0, y: 0, k: 1 };
  let fitted = false; // false → the next settle() fits (first render / project switch)
  let cw = 0,
    ch = 0; // canvas size in canvas units

  function viewportBox() {
    return { w: viewport.clientWidth, h: viewport.clientHeight };
  }

  // The scale at which the whole canvas fits the viewport. Capped at 1: content
  // smaller than the viewport opens at 1:1 and centered, never magnified.
  function fitScale() {
    const { w: vw, h: vh } = viewportBox();
    if (!cw || !ch || !vw || !vh) return 1;
    return Math.min(vw / cw, vh / ch, 1);
  }

  // Interactive zoom-out stops at MIN_K — or at fit, when the content is so large
  // that seeing it whole needs more zoom-out than that. Either way "all of it" is
  // always reachable, and zoom-out never becomes zoom-in at the bound.
  function minScale() {
    return Math.min(MIN_K, fitScale());
  }

  // Keep PAN_KEEP px of canvas inside the viewport on every edge, so a hard drag
  // can never leave a blank screen with no obvious way back.
  function clampView() {
    const { w: vw, h: vh } = viewportBox();
    const sw = cw * view.k,
      sh = ch * view.k;
    const keepX = Math.min(PAN_KEEP, sw),
      keepY = Math.min(PAN_KEEP, sh);
    view.x = Math.min(vw - keepX, Math.max(keepX - sw, view.x));
    view.y = Math.min(vh - keepY, Math.max(keepY - sh, view.y));
  }

  function applyView() {
    clampView();
    // Whole-pixel translation at 1:1 keeps text crisp; a fractional offset makes
    // the browser resample the entire layer.
    const x = view.k === 1 ? Math.round(view.x) : view.x;
    const y = view.k === 1 ? Math.round(view.y) : view.y;
    canvas.style.transform = `translate(${x}px, ${y}px) scale(${view.k})`;
    updateMinimapViewport();
  }

  // Returns whether it actually fitted: a view's tab can be display:none (0×0)
  // when its model arrives, and a fit against a zero viewport is meaningless.
  function fitView() {
    const { w: vw, h: vh } = viewportBox();
    if (!cw || !ch || !vw || !vh) return false;
    const k = fitScale();
    view = { k, x: (vw - cw * k) / 2, y: (vh - ch * k) / 2 };
    applyView();
    return true;
  }

  // Zoom about a viewport point: convert it to canvas coordinates, rescale, then
  // translate so that same canvas point lands back under the pointer.
  function zoomAt(clientX, clientY, factor) {
    const r = viewport.getBoundingClientRect();
    const px = clientX - r.left,
      py = clientY - r.top;
    const k = Math.max(minScale(), Math.min(MAX_K, view.k * factor));
    if (k === view.k) return;
    view.x = px - ((px - view.x) / view.k) * k;
    view.y = py - ((py - view.y) / view.k) * k;
    view.k = k;
    applyView();
  }

  function zoomAtCenter(factor) {
    const r = viewport.getBoundingClientRect();
    zoomAt(r.left + r.width / 2, r.top + r.height / 2, factor);
  }

  function panBy(dx, dy) {
    view.x += dx;
    view.y += dy;
    applyView();
  }

  function setCanvasSize(w, h) {
    cw = w;
    ch = h;
  }

  // The empty-state path: nothing to navigate, so match the canvas to the viewport
  // and drop the transform rather than leaving a stale one behind. Views whose
  // empty state is absolutely centered inside the canvas depend on this.
  function reset() {
    const { w: vw, h: vh } = viewportBox();
    cw = vw;
    ch = vh;
    canvas.style.width = vw + "px";
    canvas.style.height = vh + "px";
    view = { x: 0, y: 0, k: 1 };
    canvas.style.transform = "";
    minimap.classList.add("hidden");
  }

  // First render of a project fits; every later render keeps the reader's place.
  function settle() {
    if (fitted) applyView();
    else fitted = fitView();
  }

  // ── minimap ──
  // One SVG whose viewBox *is* the canvas, so the browser does the scaling and the
  // coordinates the view already computed are reused verbatim.
  function renderMinimap() {
    // Built unconditionally, even while hidden: a later resize can reveal it, and
    // it must not surface holding a previous model's picture.
    syncVisibility();
    if (!cw || !ch) return;
    const scale = Math.min(MM_MAX_W / cw, MM_MAX_H / ch);
    minimap.style.width = Math.round(cw * scale) + "px";
    minimap.style.height = Math.round(ch * scale) + "px";
    minimapSvg.setAttribute("viewBox", `0 0 ${cw} ${ch}`);
    minimapSvg.innerHTML = drawMinimapContent() + '<rect class="mm-view" x="0" y="0" width="0" height="0" rx="6"/>';
    updateMinimapViewport();
  }

  // Depends on viewport size, so it is re-evaluated on reveal and resize too, not
  // only on render. A 0×0 viewport (hidden tab) cannot answer the question — and
  // would answer it wrongly, since "canvas wider than viewport" is trivially true
  // against zero — so the decision is deferred to the reveal.
  function syncVisibility() {
    const { w: vw, h: vh } = viewportBox();
    if (!vw || !vh) return false;
    const show = shouldShowMinimap(cw, ch, vw, vh);
    minimap.classList.toggle("hidden", !show);
    return show;
  }

  function updateMinimapViewport() {
    const r = minimapSvg.querySelector(".mm-view");
    if (!r) return;
    const { w: vw, h: vh } = viewportBox();
    r.setAttribute("x", -view.x / view.k);
    r.setAttribute("y", -view.y / view.k);
    r.setAttribute("width", vw / view.k);
    r.setAttribute("height", vh / view.k);
  }

  // Map a pointer position inside the minimap back through the viewBox scale and
  // center the viewport on it. The box is sized to the canvas aspect ratio, so the
  // SVG never letterboxes and this mapping is exact.
  function minimapJump(clientX, clientY) {
    const r = minimapSvg.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const px = ((clientX - r.left) / r.width) * cw;
    const py = ((clientY - r.top) / r.height) * ch;
    const { w: vw, h: vh } = viewportBox();
    view.x = vw / 2 - px * view.k;
    view.y = vh / 2 - py * view.k;
    applyView();
  }

  // ── input ──

  let dragging = null;
  viewport.addEventListener("pointerdown", (e) => {
    // Nodes are not draggable (their positions are derived) and must not be
    // selected by a drag that happens to end on them; overlays own their gestures.
    if (e.button !== 0 || e.target.closest(dragIgnoreSelector)) return;
    dragging = { id: e.pointerId, x: e.clientX, y: e.clientY };
    viewport.setPointerCapture(e.pointerId);
    viewport.classList.add("dragging");
    canvas.style.willChange = "transform"; // only while dragging — a permanent hint costs a texture
  });
  viewport.addEventListener("pointermove", (e) => {
    if (!dragging || e.pointerId !== dragging.id) return;
    panBy(e.clientX - dragging.x, e.clientY - dragging.y);
    dragging.x = e.clientX;
    dragging.y = e.clientY;
  });
  function endDrag(e) {
    if (!dragging || e.pointerId !== dragging.id) return;
    dragging = null;
    viewport.classList.remove("dragging");
    canvas.style.willChange = "";
  }
  viewport.addEventListener("pointerup", endDrag);
  viewport.addEventListener("pointercancel", endDrag);

  // Bare wheel / two-finger trackpad pans; ctrl/cmd + wheel zooms — which is also
  // how a trackpad pinch is reported. Needs passive:false to preventDefault, or the
  // page scrolls instead.
  viewport.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const lines = e.deltaMode === 1 ? 16 : 1; // deltaMode 1 = lines, not pixels
      const dx = e.deltaX * lines,
        dy = e.deltaY * lines;
      if (e.ctrlKey || e.metaKey) zoomAt(e.clientX, e.clientY, Math.exp(-dy * 0.0015));
      else panBy(-dx, -dy);
    },
    { passive: false }
  );

  viewport.addEventListener("keydown", (e) => {
    const { w: vw, h: vh } = viewportBox();
    switch (e.key) {
      case "ArrowLeft":
        panBy(vw * 0.2, 0);
        break;
      case "ArrowRight":
        panBy(-vw * 0.2, 0);
        break;
      case "ArrowUp":
        panBy(0, vh * 0.2);
        break;
      case "ArrowDown":
        panBy(0, -vh * 0.2);
        break;
      case "+":
      case "=":
        zoomAtCenter(ZOOM_STEP);
        break;
      case "-":
      case "_":
        zoomAtCenter(1 / ZOOM_STEP);
        break;
      case "0":
        fitView();
        break;
      default:
        return;
    }
    e.preventDefault(); // arrows would otherwise scroll an ancestor
  });

  let mmDragging = false;
  minimap.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    mmDragging = true;
    minimap.setPointerCapture(e.pointerId);
    minimapJump(e.clientX, e.clientY);
    e.preventDefault();
  });
  minimap.addEventListener("pointermove", (e) => {
    if (mmDragging) minimapJump(e.clientX, e.clientY);
  });
  minimap.addEventListener("pointerup", () => (mmDragging = false));
  minimap.addEventListener("pointercancel", () => (mmDragging = false));

  // Scoped to this viewport, so two controllers never fight over one control.
  viewport.querySelector(".canvas-btn.zoom-in").addEventListener("click", () => zoomAtCenter(ZOOM_STEP));
  viewport.querySelector(".canvas-btn.zoom-out").addEventListener("click", () => zoomAtCenter(1 / ZOOM_STEP));
  viewport.querySelector(".canvas-btn.zoom-fit").addEventListener("click", fitView);

  // Fit, clamp and minimap visibility all depend on viewport size, so a resize has
  // to re-run them. This also catches a tab going from display:none to visible: the
  // first real size we see is where a pending initial fit belongs.
  // Held in a binding rather than left anonymous: an unreferenced observer is not
  // reliably kept alive by every engine, and a collected one fails silently.
  // Re-decide everything that depends on viewport size. Driven from two places:
  // a resize, and an explicit reveal when the view's tab is switched to. The tab
  // click is the deterministic one — a hidden tab reports 0×0, and a board first
  // rendered in that state is neither fitted nor able to judge its minimap.
  function revalidate() {
    syncVisibility();
    if (fitted) {
      if (cw && ch) applyView();
      return;
    }
    // Still unfitted means the last render met a 0×0 viewport. The first real
    // size we see is where the initial fit belongs, and a view that measures its
    // DOM (or that reset itself against a zero viewport) needs a full re-render
    // to get there, not just a fit.
    if (onReveal) onReveal();
    else if (cw && ch) fitted = fitView();
  }

  // Held in a binding rather than left anonymous: an unreferenced observer is not
  // reliably kept alive by every engine, and a collected one fails silently.
  const resizeObserver = new ResizeObserver(revalidate);
  resizeObserver.observe(viewport);

  return {
    applyView,
    fitView,
    panBy,
    zoomAtCenter,
    setCanvasSize,
    renderMinimap,
    syncVisibility,
    revalidate,
    reset,
    settle,
    isFitted: () => fitted,
    markUnfitted: () => {
      fitted = false;
    },
  };
}

// The roadmap's instance. Its minimap shows phase frames plus measured card
// rects, and appears once the plan has more than one phase — structure worth
// surveying — or whenever the canvas outruns the viewport, which also covers a
// single phase with a tall stack.
const roadmapCanvas = createCanvasController({
  viewport: boardWrap,
  canvas: board,
  minimap,
  minimapSvg,
  dragIgnoreSelector: ".gcard, .canvas-controls, .minimap",
  shouldShowMinimap: (cw, ch, vw, vh) => phaseCount > 1 || cw > vw || ch > vh,
  drawMinimapContent: () => {
    const { open, pos, frames } = boardMinimapData;
    let s = "";
    for (const f of frames) s += `<rect class="mm-frame" x="${f.x}" y="${f.y}" width="${f.w}" height="${f.h}" rx="16"/>`;
    for (const c of open) {
      const p = pos[c.name];
      if (!p) continue;
      const sel = selectedChange === c.name ? " sel" : "";
      s += `<rect class="mm-card${sel}" x="${p.x - N_HALF}" y="${p.top}" width="${2 * N_HALF}" height="${p.h}" rx="10"/>`;
    }
    return s;
  },
  // The roadmap measures card heights, which read 0 while its tab is hidden — so
  // a reveal needs a full re-render to re-measure, not just a fit.
  onReveal: () => {
    if (model) renderBoard();
  },
});

// ═══════════════ MCP TOPOLOGY (circuit board) ═══════════════
// Two bank columns flanking the hub chip. The single source of truth for the hub
// and the banks lives here: the canvas height varies with the server count, so
// neither CSS nor a hardcoded viewBox can hold this geometry any more.
const PCB_W = 1200, // canvas width — two bank columns plus the hub between them
  PCB_BASE_H = 640, // base height; the canvas grows past this rather than compressing
  PCB_BASE_TOP = 72, // top/bottom margin of the base band
  PCB_BASE_BOT = 568,
  PCB_CX = 600, // hub center x
  CHW = 152, // hub chip size (matches .mcu in CSS)
  CHH = 150,
  LEFT_X = 150, // bank card columns
  RIGHT_X = 854,
  LEFT_PAD = 346, // where a trace meets its card
  RIGHT_PAD = 854,
  COMP_W = 196, // card size (matches .pcb-comp in CSS)
  COMP_HALF = 28, // half card height: the solder pad sits on the card's center
  COMP_PITCH = 78; // minimum vertical pitch — a ~56px card plus breathing room

let topoMinimapData = { hub: null, comps: [] };

// The topology's controller. Its minimap shows the hub chip plus one rect per
// server, and appears once the canvas has grown past its base height — the
// equivalent of the roadmap's "more than one phase" — or whenever it overruns
// the viewport. Nothing here is measured from the DOM, so no onReveal is needed:
// a plain fit on reveal is correct.
const topologyCanvas = createCanvasController({
  viewport: topoWrap,
  canvas: topoNodes,
  minimap: topoMinimap,
  minimapSvg: topoMinimapSvg,
  dragIgnoreSelector: ".pcb-comp, .mcu, .canvas-controls, .minimap",
  shouldShowMinimap: (cw, ch, vw, vh) => ch > PCB_BASE_H || cw > vw || ch > vh,
  // Nothing here is measured from the DOM, but the empty-server path resets the
  // canvas against the live viewport — which is 0×0 while the tab is hidden — so
  // a reveal still needs the render, not just a fit.
  onReveal: () => {
    if (mcpModel) renderTopology();
  },
  drawMinimapContent: () => {
    const { hub, comps } = topoMinimapData;
    let s = "";
    if (hub) s += `<rect class="mm-frame" x="${hub.x}" y="${hub.y}" width="${CHW}" height="${CHH}" rx="10"/>`;
    for (const c of comps) {
      const sel = selectedServer === c.name ? " sel" : "";
      s += `<rect class="mm-card${sel}" x="${c.x}" y="${c.y}" width="${COMP_W}" height="${2 * COMP_HALF}" rx="8"/>`;
    }
    return s;
  },
});

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

  const vis = visibleServers();
  if (!vis.length) {
    topoNodes.appendChild(
      el("div", "topo-empty", mcpModel.servers.length ? "No servers match this scope." : "No MCP servers found in your Claude Code config.")
    );
    // `.topo-empty` centers itself inside the canvas and carries its own
    // transform, so the canvas has to match the viewport and drop the pan/zoom.
    topologyCanvas.reset();
    topoMinimapData = { hub: null, comps: [] };
    return;
  }

  const half = Math.ceil(vis.length / 2);
  const leftBank = vis.slice(0, half);
  const rightBank = vis.slice(half);

  // Spread across the base band while that still leaves cards comfortably apart;
  // once the spread would squeeze them tighter than COMP_PITCH, hold the pitch and
  // let the canvas grow instead. Below the crossover the geometry is identical to
  // the fixed-band layout this replaced, so small boards look untouched.
  const pitchOf = (n) => (n <= 1 ? 0 : Math.max(COMP_PITCH, (PCB_BASE_BOT - PCB_BASE_TOP) / (n - 1)));
  const leftPitch = pitchOf(leftBank.length),
    rightPitch = pitchOf(rightBank.length);
  const spanOf = (n, pitch) => Math.max(n - 1, 0) * pitch;
  const maxSpan = Math.max(spanOf(leftBank.length, leftPitch), spanOf(rightBank.length, rightPitch));

  const canvasW = PCB_W;
  const canvasH = Math.max(PCB_BASE_H, maxSpan + 2 * PCB_BASE_TOP);
  const cy = canvasH / 2;
  topoNodes.style.width = canvasW + "px";
  topoNodes.style.height = canvasH + "px";
  spokesSvg.setAttribute("viewBox", `0 0 ${canvasW} ${canvasH}`);
  topologyCanvas.setCanvasSize(canvasW, canvasH);

  // MCU chip (hub), positioned from the same constants the traces use — the
  // canvas height varies now, so CSS cannot hold this.
  const mcu = el("div", "mcu");
  mcu.style.left = PCB_CX - CHW / 2 + "px";
  mcu.style.top = cy - CHH / 2 + "px";
  mcu.appendChild(el("div", "mcu-name", mcpModel.hub || "Claude Code"));
  mcu.appendChild(el("div", "mcu-sub", "MCU · hub"));
  topoNodes.appendChild(mcu);

  const pinSp = (n) => Math.min(26, 120 / Math.max(n, 1));
  // Each bank is centered on the canvas, so an odd split does not sit top-heavy.
  const yOf = (n, i, pitch) => cy - spanOf(n, pitch) / 2 + i * pitch;
  const lineFor = (sc) => (sc === "global" ? "var(--line-a)" : "var(--line-b)");
  const liveUp = (s) => ["available", "already-running"].includes(liveOf(s));

  const traces = [];
  const comps = [];

  leftBank.forEach((s, i) => {
    const yc = yOf(leftBank.length, i, leftPitch),
      padX = LEFT_PAD;
    const pinY = cy + (i - (leftBank.length - 1) / 2) * pinSp(leftBank.length),
      sx = PCB_CX - CHW / 2,
      midX = 452 - i * 22;
    placeComp(s, LEFT_X, yc - COMP_HALF);
    comps.push({ x: LEFT_X, y: yc - COMP_HALF, name: s.name });
    traces.push({ d: `M ${sx} ${pinY} H ${midX} V ${yc} H ${padX}`, color: lineFor(s.scope), dash: s.scope === "project", flow: liveUp(s), px: sx, py: pinY, qx: padX, qy: yc });
  });
  rightBank.forEach((s, i) => {
    const yc = yOf(rightBank.length, i, rightPitch),
      padX = RIGHT_PAD;
    const pinY = cy + (i - (rightBank.length - 1) / 2) * pinSp(rightBank.length),
      ex = PCB_CX + CHW / 2,
      midX = 748 + i * 22;
    placeComp(s, RIGHT_X, yc - COMP_HALF);
    comps.push({ x: RIGHT_X, y: yc - COMP_HALF, name: s.name });
    traces.push({ d: `M ${ex} ${pinY} H ${midX} V ${yc} H ${padX}`, color: lineFor(s.scope), dash: s.scope === "project", flow: liveUp(s), px: ex, py: pinY, qx: padX, qy: yc });
  });

  drawTraces(traces);
  topoMinimapData = { hub: { x: PCB_CX - CHW / 2, y: cy - CHH / 2 }, comps };
  topologyCanvas.renderMinimap();
  topologyCanvas.settle();
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
  const wasHidden = detail.classList.contains("hidden");
  detail.classList.remove("hidden");
  detail.classList.toggle("server", !!server);
  // Re-trigger the slide-in only on a genuine open — not on a live re-render of
  // an already-visible panel, which would otherwise flicker on every push.
  if (wasHidden) {
    detail.style.animation = "none";
    void detail.offsetWidth;
    detail.style.animation = "";
  }
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

  const action = changeAction(c);
  if (action) {
    const btn = el("button", "detail-action " + action.kind, "Copy " + action.command);
    btn.addEventListener("click", () => copyCommand(action.command));
    inner.appendChild(btn);
  }

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

  // Full task list, grouped by section, below the progress bar. Read-only —
  // it mirrors state parsed from tasks.md and offers no toggle control.
  if (c.tasks?.length) {
    const list = el("div", "detail-tasklist");
    for (const group of c.tasks) {
      if (group.section) list.appendChild(el("div", "detail-tasklist-section", group.section));
      for (const item of group.items) {
        const row = el("div", "detail-task" + (item.done ? " done" : ""));
        row.appendChild(el("span", "detail-task-mark", item.done ? "✓" : ""));
        row.appendChild(el("span", "detail-task-text", item.text));
        list.appendChild(row);
      }
    }
    inner.appendChild(list);
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

// ═══════════════ command handoff (clipboard + toast) ═══════════════

// A single reused toast node, auto-dismissed. DataLoom prepares a command; the
// user runs it in their own Claude Code session — so a copy is confirmed here,
// never executed.
let toastEl = null;
let toastTimer = null;
function showToast(message, tone) {
  if (!toastEl) {
    toastEl = el("div", "toast");
    document.body.appendChild(toastEl);
  }
  toastEl.textContent = message;
  toastEl.className = "toast" + (tone ? " " + tone : "");
  // force reflow so re-triggering the transition restarts it
  void toastEl.offsetWidth;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 3200);
}

// Copy a Claude Code command to the clipboard and confirm via a toast. Purely
// client-side: no network call, no daemon/agent activity. On localhost the
// Clipboard API is available (secure context); a rejection or its absence falls
// back to showing the command for manual copy.
async function copyCommand(command) {
  try {
    await navigator.clipboard.writeText(command);
    showToast(`Copied ${command} — paste into Claude Code`);
  } catch {
    showToast(`Couldn't copy — run this in Claude Code: ${command}`, "warn");
  }
}

// The command action a change offers, derived from state the model already
// carries. Kept in one place so a card and the detail panel always agree:
//   archived            → nothing
//   tasks all complete  → archive
//   ready (incomplete)  → apply
//   otherwise           → nothing
function changeAction(c) {
  if (c.archived) return null;
  if (c.totalTasks > 0 && c.completedTasks === c.totalTasks) {
    return { kind: "archive", label: "Archive", command: "/opsx:archive " + c.name };
  }
  if (c.readiness === "ready") {
    return { kind: "apply", label: "Apply", command: "/opsx:apply " + c.name };
  }
  return null;
}

// ═══════════════ SYSTEM ATLAS ═══════════════
// The settled system as Arc42-flavored documentation, derived by the daemon and
// pushed like the roadmap. Strictly read-only: it renders each requirement's
// provenance but offers no control that edits a spec or proposal.

function setAtlas(a) {
  atlas = a;
  renderAtlas();
}

// ── recency overlay: "changed since your last visit" ──
// Per-viewer UI state, persisted client-side per project — never written to the
// workspace. The daemon supplies the provenance dates; the browser owns the cursor.
function atlasSeenKey() {
  return "dataloom-atlas-seen:" + ((projects && projects.current) || "");
}
function getStoredSeen() {
  const v = localStorage.getItem(atlasSeenKey());
  return v == null ? null : Number(v);
}
function setStoredSeen(ts) {
  try {
    localStorage.setItem(atlasSeenKey(), String(ts));
  } catch (e) {
    /* storage unavailable — the overlay simply won't persist */
  }
}
// Establish the marking baseline as the atlas is entered, then advance the
// persisted cursor to now — so what is seen this visit clears on reload.
function enterAtlas() {
  const stored = getStoredSeen();
  atlasSeenBaseline = stored == null ? Date.now() : stored; // first visit → now (nothing stale)
  setStoredSeen(Date.now());
}
// Archive dates are day-granular; treat one as its start-of-day instant and mark
// it when that instant is past the cursor (a single rule → no off-by-a-day flicker).
function afterSeen(date) {
  if (atlasSeenBaseline == null || !date) return false;
  const t = Date.parse(date + "T00:00:00");
  return !isNaN(t) && t > atlasSeenBaseline;
}
// null | "new" (introduced since the last visit) | "mod" (modified since).
function markOf(prov) {
  if (!prov) return null;
  if (prov.introduced && afterSeen(prov.introduced.date)) return "new";
  if (prov.modified && prov.modified.some((m) => afterSeen(m.date))) return "mod";
  return null;
}
// A block is "new" when the whole capability arrived since the last visit, else
// "mod" when it or any of its requirements changed since.
function blockMark(b) {
  const cm = markOf(b.provenance);
  if (cm) return cm;
  for (const r of b.requirements) if (markOf(r.provenance)) return "mod";
  return null;
}
function markAllRead() {
  atlasSeenBaseline = Date.now();
  setStoredSeen(atlasSeenBaseline);
  renderAtlas();
}
function sinceDot(kind) {
  const s = el("span", "atlas-since " + kind, kind === "new" ? "new" : "changed");
  s.title = "Since your last visit";
  return s;
}
function scrollToBlock(name) {
  const t = document.getElementById("atlas-cap-" + name);
  if (!t) return;
  t.scrollIntoView({ behavior: "smooth", block: "start" });
  t.classList.add("flash");
  setTimeout(() => t.classList.remove("flash"), 1200);
}
// "N changed since your last visit" + jump chips + mark-all-read.
function recencyBar(changed) {
  const bar = el("div", "atlas-recency");
  const head = el("div", "atlas-recency-head");
  head.appendChild(el("span", "atlas-recency-count", changed.length + " changed since your last visit"));
  const clear = el("button", "atlas-recency-clear", "mark all read");
  clear.addEventListener("click", markAllRead);
  head.appendChild(clear);
  bar.appendChild(head);
  const chips = el("div", "atlas-recency-chips");
  for (const c of changed) {
    const chip = el("a", "atlas-recency-chip " + c.kind, c.name);
    chip.href = "#atlas-cap-" + c.name;
    chip.addEventListener("click", (e) => {
      e.preventDefault();
      scrollToBlock(c.name);
    });
    chips.appendChild(chip);
  }
  bar.appendChild(chips);
  return bar;
}

function renderAtlas() {
  atlasBody.innerHTML = "";
  if (!atlas || (!atlas.overview && !(atlas.groups && atlas.groups.length))) {
    const msg =
      projects && projects.current
        ? "No settled capabilities yet — the atlas fills in as changes are archived."
        : "Select a project above to begin.";
    atlasBody.appendChild(el("div", "empty-state", msg));
    return;
  }

  // Recency overlay: what changed since the viewer's last visit (see the tab
  // handler / enterAtlas for the baseline). Absent → no bar, no marks.
  const changed = [];
  for (const g of atlas.groups || []) {
    for (const b of g.blocks) {
      const m = blockMark(b);
      if (m) changed.push({ name: b.name, kind: m });
    }
  }
  if (changed.length) atlasBody.appendChild(recencyBar(changed));

  // Overview (config.yaml context) — a populated section only when present.
  if (atlas.overview) {
    const ov = el("section", "atlas-overview");
    ov.appendChild(el("div", "atlas-kicker", "Overview"));
    ov.appendChild(renderMarkdown(atlas.overview));
    atlasBody.appendChild(ov);
  }

  // Building blocks, grouped by the project's own domain (from the model).
  if (atlas.groups && atlas.groups.length) {
    const blocks = el("section", "atlas-blocks");
    blocks.appendChild(el("div", "atlas-kicker", "Building blocks"));
    for (const g of atlas.groups) {
      const group = el("div", "atlas-group");
      if (!g.singleton) {
        const gh = el("div", "atlas-group-head");
        gh.appendChild(el("span", "atlas-group-key", g.key));
        gh.appendChild(el("span", "atlas-group-count", g.blocks.length + " capabilities"));
        group.appendChild(gh);
      }
      for (const b of g.blocks) group.appendChild(renderBlock(b));
      blocks.appendChild(group);
    }
    atlasBody.appendChild(blocks);
  }

  // Decisions & rationale — a global, chronological view (newest first). Absent
  // when there is no archive to draw from.
  if (atlas.decisions && atlas.decisions.length) {
    const dec = el("section", "atlas-decisions");
    dec.appendChild(el("div", "atlas-kicker", "Decisions & rationale"));
    for (const d of atlas.decisions) dec.appendChild(decisionEntry(d, false));
    atlasBody.appendChild(dec);
  }
}

function renderBlock(b) {
  const block = el("div", "atlas-block");
  block.id = "atlas-cap-" + b.name;

  const bmark = blockMark(b);
  if (bmark) block.classList.add("changed");
  const head = el("div", "atlas-block-head");
  const left = el("span", "atlas-block-headleft");
  left.appendChild(el("span", "atlas-block-name", b.name));
  if (bmark) left.appendChild(sinceDot(bmark));
  head.appendChild(left);
  head.appendChild(provChips(b.provenance));
  block.appendChild(head);

  // Density-adaptive: a small capability opens fully; a large one stays a
  // scannable outline of requirement titles that expand on demand.
  const openByDefault = b.requirements.length <= 2;

  const reqs = el("div", "atlas-reqs");
  if (!b.requirements.length) reqs.appendChild(el("div", "atlas-none", "No requirements captured."));
  for (const r of b.requirements) {
    const rmark = markOf(r.provenance);
    const d = el("details", "atlas-req" + (rmark ? " changed" : ""));
    if (openByDefault || rmark) d.open = true; // recency-driven disclosure
    const sum = el("summary", "atlas-req-sum");
    const left = el("span", "atlas-req-left");
    if (rmark) left.appendChild(sinceDot(rmark));
    left.appendChild(el("span", "atlas-req-title", r.title));
    sum.appendChild(left);
    const last = lastTouch(r.provenance);
    if (last) {
      const changed = r.provenance.modified && r.provenance.modified.length > 0;
      const chip = el("span", "atlas-req-prov " + (changed ? "mod" : "new"), (changed ? "changed " : "new ") + (last.date || ""));
      chip.title = "shaped by " + last.change + " — open the rationale";
      chip.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        scrollToDecision(last.change);
      });
      sum.appendChild(chip);
    }
    d.appendChild(sum);
    lazyBody(d, () => buildReqBody(r), openByDefault || !!rmark);
    reqs.appendChild(d);
  }
  block.appendChild(reqs);

  // Per-capability shaping history: the changes that shaped this block, newest
  // first, each expandable to its rationale.
  const shaping = shapingFor(b);
  if (shaping.length) {
    const sh = el("details", "atlas-shaping");
    sh.appendChild(el("summary", "atlas-shaping-sum", "Shaping decisions & history · " + shaping.length));
    for (const d of shaping) sh.appendChild(decisionEntry(d, true));
    block.appendChild(sh);
  }
  return block;
}

/** A requirement's expanded body: its normative prose + behavior scenarios. */
function buildReqBody(r) {
  const body = el("div", "atlas-req-body");
  if (r.text) body.appendChild(renderMarkdown(r.text));
  if (r.scenarios && r.scenarios.length) {
    const sc = el("div", "atlas-scenarios");
    sc.appendChild(el("div", "atlas-scenarios-head", r.scenarios.length + " behavior" + (r.scenarios.length > 1 ? "s" : "")));
    for (const s of r.scenarios) {
      const item = el("div", "atlas-scenario");
      item.appendChild(el("div", "atlas-scenario-title", s.title));
      item.appendChild(renderMarkdown(s.body));
      sc.appendChild(item);
    }
    body.appendChild(sc);
  }
  return body;
}

/** The decisions that introduced/modified this block's capability or any requirement, newest first. */
function shapingFor(b) {
  const names = new Set();
  const add = (p) => {
    if (!p) return;
    if (p.introduced) names.add(p.introduced.change);
    for (const m of p.modified || []) names.add(m.change);
  };
  add(b.provenance);
  for (const r of b.requirements) add(r.provenance);
  return (atlas.decisions || []).filter((d) => names.has(d.change));
}

function decisionEntry(d, nested) {
  const det = el("details", "atlas-decision" + (nested ? " nested" : ""));
  if (!nested) det.id = "atlas-change-" + d.change; // the global entry owns the anchor
  const sum = el("summary", "atlas-decision-sum");
  sum.appendChild(el("span", "atlas-decision-date", d.date || "—"));
  sum.appendChild(el("span", "atlas-decision-change", d.change));
  det.appendChild(sum);
  // Rationale (whole design.md) is heavy; build it only when first opened.
  lazyBody(det, () => {
    const body = el("div", "atlas-decision-body");
    if (d.why) {
      body.appendChild(el("div", "atlas-decision-label", "Why"));
      body.appendChild(renderMarkdown(d.why));
    }
    if (d.design) {
      body.appendChild(el("div", "atlas-decision-label", "Design"));
      body.appendChild(renderMarkdown(d.design));
    }
    if (!d.why && !d.design) body.appendChild(el("div", "atlas-none", "No recorded rationale."));
    return body;
  });
  return det;
}

// Build a <details>'s body on first open (or eagerly when it starts open), so a
// page full of collapsed sections stays light until the reader expands one.
function lazyBody(details, build, eager) {
  if (eager) {
    details.appendChild(build());
    return;
  }
  let built = false;
  details.addEventListener("toggle", () => {
    if (details.open && !built) {
      built = true;
      details.appendChild(build());
    }
  });
}

/** The latest touch (last modification, else introduction) of a provenance record. */
function lastTouch(p) {
  if (!p) return null;
  if (p.modified && p.modified.length) return p.modified[p.modified.length - 1];
  return p.introduced;
}

/** "introduced <date> · changed <date>" chips, each linking to its shaping change. */
function provChips(p) {
  const wrap = el("span", "atlas-prov");
  if (p && p.introduced) wrap.appendChild(provRef("new", "introduced", p.introduced));
  const last = p && p.modified && p.modified.length ? p.modified[p.modified.length - 1] : null;
  if (last) wrap.appendChild(provRef("mod", "changed", last));
  return wrap;
}
function provRef(kind, label, ref) {
  const a = el("a", "atlas-prov-ref " + kind);
  a.href = "#atlas-change-" + ref.change;
  a.title = "shaped by " + ref.change;
  a.appendChild(el("span", "atlas-prov-lab", label));
  a.appendChild(el("span", "atlas-prov-date", ref.date || "—"));
  a.addEventListener("click", (e) => {
    e.preventDefault();
    scrollToDecision(ref.change);
  });
  return a;
}
function scrollToDecision(change) {
  const t = document.getElementById("atlas-change-" + change);
  if (!t) return;
  t.open = true;
  t.scrollIntoView({ behavior: "smooth", block: "center" });
  t.classList.add("flash");
  setTimeout(() => t.classList.remove("flash"), 1200);
}

// ── minimal, dependency-free markdown (the constrained spec/proposal subset) ──
// Handles headings, bullet lists, fenced code, **bold** and `code`. Builds DOM
// via text nodes / elements only — never innerHTML — so prose can't inject markup.
function renderMarkdown(md) {
  const root = el("div", "md");
  let para = [];
  let items = null; // buffered list-item text (built at flush so continuations attach)
  let code = null;
  const flushPara = () => {
    if (para.length) {
      const p = el("p");
      applyInline(p, para.join(" "));
      root.appendChild(p);
      para = [];
    }
  };
  const flushList = () => {
    if (items) {
      const ul = el("ul", "md-ul");
      for (const t of items) applyInline(ul.appendChild(el("li")), t);
      root.appendChild(ul);
      items = null;
    }
  };
  for (const raw of String(md == null ? "" : md).split(/\r?\n/)) {
    if (code !== null) {
      if (/^```/.test(raw)) {
        root.appendChild(code);
        code = null;
      } else {
        code.firstChild.appendChild(document.createTextNode(raw + "\n"));
      }
      continue;
    }
    if (/^```/.test(raw)) {
      flushPara();
      flushList();
      code = el("pre", "md-pre");
      code.appendChild(el("code"));
      continue;
    }
    const h = /^(#{1,6})\s+(.*)$/.exec(raw);
    if (h) {
      flushPara();
      flushList();
      applyInline(root.appendChild(el("div", "md-h md-h" + Math.min(3, h[1].length))), h[2]);
      continue;
    }
    const b = /^\s*[-*]\s+(.*)$/.exec(raw);
    if (b) {
      flushPara();
      if (!items) items = [];
      items.push(b[1]);
      continue;
    }
    if (raw.trim() === "") {
      flushPara();
      flushList();
      continue;
    }
    // An indented line under a bullet is that item's continuation, not a new block.
    if (items && /^\s/.test(raw)) {
      items[items.length - 1] += " " + raw.trim();
      continue;
    }
    para.push(raw.trim());
  }
  flushPara();
  flushList();
  if (code) root.appendChild(code);
  return root;
}

function applyInline(parent, text) {
  const re = /`([^`]+)`|\*\*([^*]+)\*\*/g;
  let last = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parent.appendChild(document.createTextNode(text.slice(last, m.index)));
    if (m[1] != null) parent.appendChild(el("code", "md-code", m[1]));
    else parent.appendChild(el("strong", null, m[2]));
    last = re.lastIndex;
  }
  if (last < text.length) parent.appendChild(document.createTextNode(text.slice(last)));
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
