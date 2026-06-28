"use strict";

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

let projects = null;
let model = null;
let cardEls = new Map(); // change name -> card element
let conflictedNames = new Set(); // change names involved in any conflict
let nextUpNames = new Set(); // ready proposals in the earliest phase (recommended next)
let doneCollapsed = true;
let detailChange = null; // name of the change shown in the detail panel

document.getElementById("detail-close").addEventListener("click", () => {
  detail.classList.add("hidden");
  detailChange = null;
});
window.addEventListener("resize", () => {
  drawEdges();
  layoutTopology();
});

// --- tab switching ---
let activeTab = "roadmap";
for (const btn of document.querySelectorAll(".tab[data-tab]")) {
  btn.addEventListener("click", () => {
    activeTab = btn.dataset.tab;
    for (const b of document.querySelectorAll(".tab")) b.classList.toggle("active", b === btn);
    for (const v of document.querySelectorAll(".view")) v.classList.toggle("active", v.id === activeTab);
    if (activeTab === "roadmap") requestAnimationFrame(drawEdges);
    if (activeTab === "topology") requestAnimationFrame(layoutTopology);
  });
}

// --- project selection ---
projectSelect.addEventListener("change", async () => {
  const path = projectSelect.value;
  try {
    const res = await fetch(`/api/project/select?path=${encodeURIComponent(path)}`, { method: "POST" });
    if (!res.ok) renderProjects(projects); // rejected — restore previous selection
  } catch (e) {
    console.error("project switch failed", e);
    renderProjects(projects);
  }
});

function setProjects(p) {
  projects = p;
  renderProjects(p);
  if (!p.current) {
    // No active project — prompt the user to pick one.
    board.innerHTML = '<div class="empty-state">Select a project above to begin.</div>';
    edgesSvg.innerHTML = "";
    doneBand.classList.add("hidden");
    conflictsEl.classList.add("hidden");
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

function render(m) {
  model = m;
  // Close a stale detail panel if its change is gone (e.g. after a project switch).
  if (detailChange && !m.changes.some((c) => c.name === detailChange)) {
    detail.classList.add("hidden");
    detailChange = null;
  }
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
  // Wait a frame so layout settles before measuring for edges.
  requestAnimationFrame(drawEdges);
}

function renderConflicts(conflicts) {
  if (!conflicts.length) {
    conflictsEl.classList.add("hidden");
    conflictsEl.innerHTML = "";
    return;
  }
  conflictsEl.classList.remove("hidden");
  conflictsEl.innerHTML =
    `<div class="conflicts-head">⚠ ${conflicts.length} conflict${conflicts.length > 1 ? "s" : ""}</div>` +
    conflicts
      .map((c) => `<div class="conflict-item conflict-${c.type}">${escapeHtml(c.description)}</div>`)
      .join("");
}

function renderReview() {
  // Open changes that have never been reviewed for dependencies.
  const pending = model.changes.filter((c) => !c.archived && c.dependencyReview === "pending");
  const n = pending.length;
  if (!n) {
    reviewEl.classList.add("hidden");
    reviewEl.innerHTML = "";
    return;
  }
  reviewEl.classList.remove("hidden");
  const subject = n > 1 ? "proposals need" : "proposal needs";
  reviewEl.innerHTML =
    `<span class="review-badge">${n}</span>` +
    `<span>${subject} dependency review — ask Claude to review ${n > 1 ? "them" : "it"} via the data-loom MCP server.</span>`;
}

function renderBoard() {
  board.innerHTML = "";
  cardEls = new Map();

  if (!model.phases.length) {
    board.innerHTML = '<div class="empty-state">No active changes yet. Propose one to populate the roadmap.</div>';
    return;
  }

  const byName = new Map(model.changes.map((c) => [c.name, c]));
  model.phases.forEach((phase, i) => {
    if (i > 0) board.appendChild(el("div", "phase-arrow", "↓"));
    const band = el("div", "phase-band");
    band.appendChild(el("div", "phase-head", `Phase <b>${phase.phase}</b>`));
    const row = el("div", "phase-band-cards");
    for (const name of phase.changeNames) {
      const c = byName.get(name);
      if (c) row.appendChild(renderCard(c));
    }
    band.appendChild(row);
    board.appendChild(band);
  });
}

function renderCard(c) {
  const warn = conflictedNames.has(c.name) || c.unsatisfiedDependencies.length > 0;
  const next = nextUpNames.has(c.name);
  const review = !c.archived && c.dependencyReview === "pending";
  const card = el("div", `card s-${c.status}${warn ? " warn" : ""}${next ? " next" : ""}${review ? " needs-review" : ""}`);
  card.appendChild(el("div", "card-name", c.name));

  const meta = el("div", "card-meta");
  meta.appendChild(el("span", `pill s-${c.status}`, c.status));
  if (!c.archived && c.readiness !== "done") {
    meta.appendChild(el("span", `pill r-${c.readiness}`, c.readiness));
  }
  if (review) {
    meta.appendChild(el("span", "pill review", "review?"));
  }
  if (c.totalTasks > 0) {
    meta.appendChild(el("span", "tasks-mini", `${c.completedTasks}/${c.totalTasks} tasks`));
  }
  card.appendChild(meta);

  if (c.readiness === "blocked") {
    const waiting = c.dependsOn.filter((d) => {
      const dep = model.changes.find((x) => x.name === d);
      return !dep || dep.status !== "done";
    });
    if (waiting.length) card.appendChild(el("div", "blocked-note", "waiting on " + waiting.map(escapeHtml).join(", ")));
  }

  const caps = el("div", "caps");
  const parts = [];
  if (c.newCapabilities.length) parts.push(`<span class="add">+${c.newCapabilities.length} new</span>`);
  if (c.modifiedCapabilities.length) parts.push(`<span class="mod">~${c.modifiedCapabilities.length} mod</span>`);
  caps.innerHTML = parts.join(" &nbsp; ");
  if (parts.length) card.appendChild(caps);

  card.addEventListener("click", () => showDetail(c));
  cardEls.set(c.name, card);
  return card;
}

function renderDoneBand() {
  const archived = model.changes.filter((c) => c.archived);
  if (!archived.length) {
    doneBand.classList.add("hidden");
    return;
  }
  doneBand.classList.remove("hidden");
  doneBand.innerHTML = "";
  const head = el("div", "doneband-head", `${doneCollapsed ? "▸" : "▾"} Done — ${archived.length} archived`);
  head.addEventListener("click", () => {
    doneCollapsed = !doneCollapsed;
    renderDoneBand();
    requestAnimationFrame(drawEdges);
  });
  doneBand.appendChild(head);
  const items = el("div", `doneband-items${doneCollapsed ? " collapsed" : ""}`);
  for (const c of archived) {
    const chip = el("div", "done-chip", c.name);
    chip.addEventListener("click", () => showDetail(c));
    items.appendChild(chip);
  }
  doneBand.appendChild(items);
}

function drawEdges() {
  edgesSvg.innerHTML =
    '<defs><marker id="dep-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">' +
    '<path d="M2 1L8 5L2 9" fill="none" stroke="var(--edge)" stroke-width="1.5"/></marker></defs>';
  if (!model) return;
  const wrap = board.parentElement.getBoundingClientRect();
  for (const c of model.changes) {
    if (c.archived) continue;
    const toEl = cardEls.get(c.name);
    if (!toEl) continue;
    for (const depName of c.dependsOn) {
      const fromEl = cardEls.get(depName);
      if (!fromEl) continue;
      const f = fromEl.getBoundingClientRect();
      const t = toEl.getBoundingClientRect();
      let d;
      if (t.top >= f.bottom - 4) {
        // dependent sits in a lower band -> vertical connector (bottom -> top)
        const x1 = f.left - wrap.left + f.width / 2;
        const y1 = f.bottom - wrap.top;
        const x2 = t.left - wrap.left + t.width / 2;
        const y2 = t.top - wrap.top;
        const my = (y1 + y2) / 2;
        d = `M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`;
      } else {
        // same band -> horizontal connector (right -> left)
        const x1 = f.right - wrap.left;
        const y1 = f.top - wrap.top + f.height / 2;
        const x2 = t.left - wrap.left;
        const y2 = t.top - wrap.top + t.height / 2;
        const mx = (x1 + x2) / 2;
        d = `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
      }
      const p = path(d);
      p.setAttribute("stroke-dasharray", "5 4");
      p.setAttribute("marker-end", "url(#dep-arrow)");
      edgesSvg.appendChild(p);
    }
  }
}

function showDetail(c) {
  detail.classList.remove("hidden");
  detailChange = c.name;
  detailBody.innerHTML = `
    <h2>${escapeHtml(c.name)}</h2>
    <div class="card-meta">
      <span class="pill s-${c.status}">${c.status}</span>
      ${c.archived ? '<span class="pill">archived</span>' : `<span class="pill">Phase ${c.phase}</span>`}
      ${c.totalTasks > 0 ? `<span class="tasks-mini">${c.completedTasks}/${c.totalTasks} tasks</span>` : ""}
    </div>
    <h3>New capabilities</h3>${list(c.newCapabilities)}
    <h3>Modified capabilities</h3>${list(c.modifiedCapabilities)}
    <h3>Depends on</h3>${list(c.dependsOn)}
    ${c.unsatisfiedDependencies.length ? `<h3>⚠ Unsatisfied</h3>${list(c.unsatisfiedDependencies)}` : ""}
  `;
}

// --- MCP topology (HOW tab) ---
let mcpModel = null;
const topoNodes = document.getElementById("topo-nodes");
const spokesSvg = document.getElementById("spokes");
let hubEl = null;
let serverEls = new Map();

function setMcp(m) {
  mcpModel = m;
  renderTopology();
}

function updateMcpServer(server) {
  if (!mcpModel) return;
  const i = mcpModel.servers.findIndex((s) => s.name === server.name);
  if (i >= 0) mcpModel.servers[i] = server;
  else mcpModel.servers.push(server);
  renderTopology();
}

function renderTopology() {
  if (!mcpModel) return;
  topoNodes.innerHTML = "";
  serverEls = new Map();

  hubEl = el("div", "topo-node hub", `<div class="topo-name">${escapeHtml(mcpModel.hub)}</div><div class="topo-sub">hub</div>`);
  topoNodes.appendChild(hubEl);

  if (!mcpModel.servers.length) {
    const empty = el("div", "topo-empty", "No MCP servers found in your Claude Code config.");
    topoNodes.appendChild(empty);
  }

  for (const s of mcpModel.servers) {
    const node = el("div", `topo-node srv live-${s.liveness} scope-${s.scope}`);
    node.innerHTML = `
      <div class="topo-name">${escapeHtml(s.name)}</div>
      <div class="topo-sub">${escapeHtml(s.transport)}${s.command ? " · " + escapeHtml(s.command) : ""}${s.url ? " · " + escapeHtml(s.url) : ""}</div>
      <div class="topo-state"><span class="live-dot"></span>${escapeHtml(livenessLabel(s.liveness))}${s.lastChecked ? " · " + new Date(s.lastChecked).toLocaleTimeString() : ""}</div>
      <button class="topo-check" type="button">check</button>`;
    node.querySelector(".topo-check").addEventListener("click", (e) => {
      e.stopPropagation();
      triggerCheck(s.name, node);
    });
    serverEls.set(s.name, node);
    topoNodes.appendChild(node);
  }
  layoutTopology();
}

function layoutTopology() {
  if (!mcpModel || !hubEl) return;
  const rect = topoNodes.getBoundingClientRect();
  if (!rect.width) return; // hidden tab — re-laid out on switch
  const cx = rect.width / 2;
  const cy = rect.height / 2;
  place(hubEl, cx, cy);
  const n = mcpModel.servers.length;
  const R = Math.max(140, Math.min(rect.width, rect.height) / 2 - 130);
  mcpModel.servers.forEach((s, i) => {
    const node = serverEls.get(s.name);
    if (!node) return;
    const ang = (i / Math.max(n, 1)) * Math.PI * 2 - Math.PI / 2;
    place(node, cx + Math.cos(ang) * R, cy + Math.sin(ang) * R);
  });
  drawSpokes();
}

function place(node, x, y) {
  node.style.left = x + "px";
  node.style.top = y + "px";
}

function drawSpokes() {
  spokesSvg.innerHTML = "";
  if (!hubEl) return;
  const wrap = topoNodes.parentElement.getBoundingClientRect();
  const h = hubEl.getBoundingClientRect();
  const hx = h.left - wrap.left + h.width / 2;
  const hy = h.top - wrap.top + h.height / 2;
  for (const [name, node] of serverEls) {
    const r = node.getBoundingClientRect();
    const x = r.left - wrap.left + r.width / 2;
    const y = r.top - wrap.top + r.height / 2;
    const server = mcpModel.servers.find((s) => s.name === name);
    const p = path(`M ${hx} ${hy} L ${x} ${y}`);
    if (server && server.scope === "project") p.setAttribute("stroke-dasharray", "5 4");
    spokesSvg.appendChild(p);
  }
}

async function triggerCheck(name, node) {
  node.className = node.className.replace(/live-\S+/g, "") + " live-checking";
  const stateEl = node.querySelector(".topo-state");
  if (stateEl) stateEl.innerHTML = '<span class="live-dot"></span>checking…';
  try {
    await fetch(`/api/mcp/check?name=${encodeURIComponent(name)}`, { method: "POST" });
    // result arrives via the ws 'mcpServer' push -> updateMcpServer re-renders
  } catch (e) {
    console.error("check failed", e);
  }
}

function livenessLabel(s) {
  return {
    unknown: "unknown",
    checking: "checking…",
    available: "available",
    "needs-auth": "needs auth",
    unreachable: "unreachable",
    "on-demand": "on-demand",
    "already-running": "running",
  }[s] || s;
}

// --- tiny DOM helpers ---
function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}
function path(d) {
  const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
  p.setAttribute("d", d);
  p.setAttribute("fill", "none");
  p.setAttribute("stroke", "var(--edge)");
  p.setAttribute("stroke-width", "1.6");
  return p;
}
function list(items) {
  if (!items || !items.length) return '<div class="empty">—</div>';
  return "<ul>" + items.map((i) => `<li><code>${escapeHtml(i)}</code></li>`).join("") + "</ul>";
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}
