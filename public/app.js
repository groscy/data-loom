"use strict";

const board = document.getElementById("board");
const edgesSvg = document.getElementById("edges");
const doneBand = document.getElementById("doneband");
const detail = document.getElementById("detail");
const detailBody = document.getElementById("detail-body");
const connDot = document.getElementById("conn-dot");
const connText = document.getElementById("conn-text");
const genEl = document.getElementById("gen");

let model = null;
let cardEls = new Map(); // change name -> card element
let doneCollapsed = true;

document.getElementById("detail-close").addEventListener("click", () => {
  detail.classList.add("hidden");
});
window.addEventListener("resize", drawEdges);

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
  genEl.textContent = m.generatedAt ? "· " + new Date(m.generatedAt).toLocaleTimeString() : "";
  renderBoard();
  renderDoneBand();
  // Wait a frame so layout settles before measuring for edges.
  requestAnimationFrame(drawEdges);
}

function renderBoard() {
  board.innerHTML = "";
  cardEls = new Map();

  if (!model.phases.length) {
    board.innerHTML = '<div class="empty-state">No active changes yet. Propose one to populate the roadmap.</div>';
    return;
  }

  const byName = new Map(model.changes.map((c) => [c.name, c]));
  for (const phase of model.phases) {
    const col = el("div", "phase-col");
    col.appendChild(el("div", "phase-head", `Phase <b>${phase.phase}</b>`));
    for (const name of phase.changeNames) {
      const c = byName.get(name);
      if (c) col.appendChild(renderCard(c));
    }
    board.appendChild(col);
  }
}

function renderCard(c) {
  const warn = c.unsatisfiedDependencies.length > 0;
  const card = el("div", `card s-${c.status}${warn ? " warn" : ""}`);
  card.appendChild(el("div", "card-name", c.name));

  const meta = el("div", "card-meta");
  meta.appendChild(el("span", `pill s-${c.status}`, c.status));
  if (c.totalTasks > 0) {
    meta.appendChild(el("span", "tasks-mini", `${c.completedTasks}/${c.totalTasks} tasks`));
  }
  card.appendChild(meta);

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
  edgesSvg.innerHTML = "";
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
      // dependency (earlier phase, left) -> dependent (later phase, right)
      const x1 = f.right - wrap.left;
      const y1 = f.top - wrap.top + f.height / 2;
      const x2 = t.left - wrap.left;
      const y2 = t.top - wrap.top + t.height / 2;
      const mx = (x1 + x2) / 2;
      edgesSvg.appendChild(
        path(`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`),
      );
    }
  }
}

function showDetail(c) {
  detail.classList.remove("hidden");
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
