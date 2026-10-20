'use strict';
/* Caderno Digital — páginas manuscritas: papel, traços, zoom, laço, anular, lápis e gravação
   Powered by Claude IA & Ideias&Soltas — concepção de produtos multimédia */

/* ---------- Desenho: papel e traços ---------- */
function drawBackground(ctx, bg, W = PAGE_W, H = PAGE_H, block = false) {
  ctx.save();
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
  const step = 34;
  if (bg === 'pautado') {
    ctx.strokeStyle = '#bcd0ea'; ctx.lineWidth = 1.2; ctx.beginPath();
    for (let y = block ? step : 112; y < H - (block ? 4 : 30); y += step) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
    ctx.stroke();
    if (!block) { ctx.strokeStyle = '#f2a7a7'; ctx.beginPath(); ctx.moveTo(92, 0); ctx.lineTo(92, H); ctx.stroke(); }
  } else if (bg === 'quadriculado') {
    ctx.strokeStyle = '#d3deec'; ctx.lineWidth = 1; ctx.beginPath();
    for (let x = step; x < W; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
    for (let y = step; y < H; y += step) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
    ctx.stroke();
  } else if (bg === 'pontilhado') {
    ctx.fillStyle = '#a9b6c8';
    for (let x = step; x < W; x += step)
      for (let y = step; y < H; y += step) { ctx.beginPath(); ctx.arc(x, y, 1.7, 0, 7); ctx.fill(); }
  }
  ctx.restore();
}
const wAt = (s, pr) => s.w * (0.35 + 1.15 * pr);
const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
function seg(ctx, s, p, i) {
  const a = p[i - 1], b = p[i];
  const m1 = i === 1 ? a : mid(p[i - 2], a), m2 = mid(a, b);
  ctx.lineWidth = wAt(s, (a[2] + b[2]) / 2);
  ctx.beginPath(); ctx.moveTo(m1[0], m1[1]); ctx.quadraticCurveTo(a[0], a[1], m2[0], m2[1]); ctx.stroke();
}
function drawStroke(ctx, s, dx = 0, dy = 0) {
  const p = s.pts; if (!p.length) return;
  ctx.save(); ctx.translate(dx, dy);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = s.color; ctx.fillStyle = s.color;
  if (s.tool === 'hl') {
    ctx.globalAlpha = 0.42; ctx.globalCompositeOperation = 'multiply'; ctx.lineWidth = s.w;
    ctx.beginPath(); ctx.moveTo(p[0][0], p[0][1]);
    if (p.length === 1) ctx.lineTo(p[0][0] + 0.1, p[0][1]);
    for (let i = 1; i < p.length; i++) ctx.lineTo(p[i][0], p[i][1]);
    ctx.stroke();
  } else if (p.length === 1) {
    ctx.beginPath(); ctx.arc(p[0][0], p[0][1], wAt(s, p[0][2]) / 2, 0, 7); ctx.fill();
  } else {
    for (let i = 1; i < p.length; i++) seg(ctx, s, p, i);
    const a = p[p.length - 2], b = p[p.length - 1], m = mid(a, b);
    ctx.lineWidth = wAt(s, b[2]); ctx.beginPath(); ctx.moveTo(m[0], m[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
  }
  ctx.restore();
}
function renderPageTo(c, p) {
  const x = c.getContext('2d');
  x.setTransform(c.width / PAGE_W, 0, 0, c.height / PAGE_H, 0, 0);
  if (p.kind === 'doc') return renderDocThumb(x, p);
  drawPageBg(x, p);
  p.strokes.forEach(s => drawStroke(x, s));
}
function renderDocThumb(x, p) {
  x.fillStyle = '#fff'; x.fillRect(0, 0, PAGE_W, PAGE_H);
  x.fillStyle = '#1d2433'; x.font = '800 64px -apple-system, "Segoe UI", sans-serif';
  x.fillText(((p.icon || '📄') + ' ' + (p.title || 'Sem título')).slice(0, 24), 70, 150);
  let y = 250;
  for (const b of p.blocks || []) {
    if (y > PAGE_H - 60) break;
    if (b.type === 'draw' || b.type === 'img' || b.type === 'table') {
      const h = b.type === 'draw' ? Math.min(b.h * 0.86, 420) : 220;
      x.fillStyle = '#e9edf3'; x.fillRect(70, y - 30, 860, h); y += h + 34; continue;
    }
    if (b.type === 'divider') { x.fillStyle = '#d9dee7'; x.fillRect(70, y - 20, 860, 3); y += 40; continue; }
    let t = plainText(b.html || '');
    if (b.type === 'link') { const q = S.pages.find(z => z.id === b.target); t = '↗ ' + (q ? pageName(q) : ''); }
    const big = /^h\d$/.test(b.type);
    x.font = `${big ? '700 46px' : '34px'} -apple-system, "Segoe UI", sans-serif`; x.fillStyle = '#475467';
    x.fillText(t.slice(0, big ? 34 : 52), 70, y); y += big ? 80 : 56;
  }
}
function plainText(html) { const d = document.createElement('div'); d.innerHTML = html; return d.textContent; }

/* ---------- Geometria ---------- */
const bbCache = new WeakMap();
function bbox(s) {
  let b = bbCache.get(s); if (b) return b;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const q of s.pts) { if (q[0] < x0) x0 = q[0]; if (q[0] > x1) x1 = q[0]; if (q[1] < y0) y0 = q[1]; if (q[1] > y1) y1 = q[1]; }
  const pad = s.tool === 'hl' ? s.w / 2 : wAt(s, 1) / 2;
  b = { x: x0 - pad, y: y0 - pad, w: x1 - x0 + 2 * pad, h: y1 - y0 + 2 * pad };
  bbCache.set(s, b); return b;
}
function unionBox(list) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const s of list) { const b = bbox(s); x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.w); y1 = Math.max(y1, b.y + b.h); }
  return { x: x0 - 6, y: y0 - 6, w: x1 - x0 + 12, h: y1 - y0 + 12 };
}
function distSeg(x, y, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], l = dx * dx + dy * dy;
  let t = l ? ((x - a[0]) * dx + (y - a[1]) * dy) / l : 0; t = clamp(t, 0, 1);
  return Math.hypot(x - (a[0] + t * dx), y - (a[1] + t * dy));
}
function strokeHit(s, x, y, r) {
  const b = bbox(s);
  if (x < b.x - r || x > b.x + b.w + r || y < b.y - r || y > b.y + b.h + r) return false;
  const p = s.pts, lim = r + (s.tool === 'hl' ? s.w / 2 : wAt(s, 1) / 2);
  if (p.length === 1) return Math.hypot(p[0][0] - x, p[0][1] - y) <= lim;
  for (let i = 1; i < p.length; i++) if (distSeg(x, y, p[i - 1], p[i]) <= lim) return true;
  return false;
}
function pip(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const inBox = (b, x, y) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
const moved = (s, dx, dy, newId) => ({ ...s, id: newId ? uid() : s.id, pts: s.pts.map(q => [r1(q[0] + dx), r1(q[1] + dy), q[2]]) });

/* ---------- Tela (canvas) e zoom ---------- */
const stage = $('#stage'), sheet = $('#sheet'), cBase = $('#cBase'), cLive = $('#cLive');
function ctxOf(c) { const x = c.getContext('2d'); x.setTransform(S.px, 0, 0, S.px, 0, 0); return x; }
function clearCtx(c) { const x = c.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, c.width, c.height); x.setTransform(S.px, 0, 0, S.px, 0, 0); return x; }
function redrawBase(except) {
  const pg = page(); if (!pg || pg.kind === 'doc') return;
  const x = clearCtx(cBase);
  drawPageBg(x, pg);
  for (const s of pg.strokes) if (!except || !except.has(s.id)) drawStroke(x, s);
}
function layout() {
  if (!S.nb || isDoc()) return;
  if (S.act) cancelAct();
  const sw = stage.clientWidth, sh = stage.clientHeight;
  let sc = S.scale;
  if (S.fit === 'width') sc = (sw - 32) / PAGE_W;
  else if (S.fit === 'page') sc = Math.min((sw - 32) / PAGE_W, (sh - 32) / PAGE_H);
  sc = clamp(sc, 0.25, 4); S.scale = sc;
  const cssW = PAGE_W * sc, cssH = PAGE_H * sc;
  let dpr = window.devicePixelRatio || 1;
  const maxPx = 12e6;                                  // limite de memória do Safari para canvas
  if (cssW * cssH * dpr * dpr > maxPx) dpr = Math.sqrt(maxPx / (cssW * cssH));
  S.px = sc * dpr;
  for (const c of [cBase, cLive]) {
    c.width = Math.round(cssW * dpr); c.height = Math.round(cssH * dpr);
    c.style.width = cssW + 'px'; c.style.height = cssH + 'px';
  }
  sheet.style.width = cssW + 'px'; sheet.style.height = cssH + 'px';
  redrawBase(); showSel(); updateFitLabel();
}
function zoomTo(sc) {
  const cx = (stage.scrollLeft + stage.clientWidth / 2 - sheet.offsetLeft) / S.scale;
  const cy = (stage.scrollTop + stage.clientHeight / 2 - sheet.offsetTop) / S.scale;
  S.fit = 'custom'; S.scale = clamp(sc, 0.25, 4); layout();
  stage.scrollLeft = cx * S.scale + sheet.offsetLeft - stage.clientWidth / 2;
  stage.scrollTop = cy * S.scale + sheet.offsetTop - stage.clientHeight / 2;
}
function updateFitLabel() {
  $('#btnFit').textContent = S.fit === 'width' ? 'Largura' : S.fit === 'page' ? 'Página inteira' : Math.round(S.scale * 100) + '%';
}

/* ---------- Seleção (laço) ---------- */
function showSel() {
  const b = $('#selBox');
  if (!S.sel) { b.classList.add('hidden'); return; }
  const bx = S.sel.box;
  Object.assign(b.style, { left: bx.x * S.scale + 'px', top: bx.y * S.scale + 'px', width: bx.w * S.scale + 'px', height: bx.h * S.scale + 'px' });
  b.classList.remove('hidden');
}
function clearSel() { S.sel = null; showSel(); }
function selectPoly(poly) {
  if (poly.length < 3) return;
  const pg = page(), ids = new Set();
  for (const s of pg.strokes) {
    let inside = 0; for (const q of s.pts) if (pip(q[0], q[1], poly)) inside++;
    if (inside && inside >= s.pts.length * 0.5) ids.add(s.id);
  }
  if (!ids.size) return;
  S.sel = { ids, box: unionBox(pg.strokes.filter(s => ids.has(s.id))) };
  showSel();
}
function drawSelLive(dx, dy) {
  const x = clearCtx(cLive);
  for (const s of page().strokes) if (S.sel.ids.has(s.id)) drawStroke(x, s, dx, dy);
  const b = S.sel.box;
  x.save(); x.strokeStyle = '#2f7cf6'; x.lineWidth = 1.5 / S.scale; x.setLineDash([6 / S.scale, 5 / S.scale]);
  x.strokeRect(b.x + dx, b.y + dy, b.w, b.h); x.restore();
}
function drawLasso(poly) {
  const x = clearCtx(cLive);
  x.save(); x.strokeStyle = '#2f7cf6'; x.lineWidth = 1.6 / S.scale; x.setLineDash([6 / S.scale, 5 / S.scale]);
  x.beginPath(); poly.forEach((q, i) => i ? x.lineTo(q[0], q[1]) : x.moveTo(q[0], q[1])); x.closePath(); x.stroke(); x.restore();
}
function selAction(kind) {
  if (!S.sel) return;
  const pg = page();
  pushHist(pg.strokes);
  if (kind === 'del') {
    pg.strokes = pg.strokes.filter(s => !S.sel.ids.has(s.id)); clearSel();
  } else if (kind === 'dup') {
    const copies = pg.strokes.filter(s => S.sel.ids.has(s.id)).map(s => moved(s, 24, 24, true));
    pg.strokes = pg.strokes.concat(copies);
    S.sel = { ids: new Set(copies.map(s => s.id)), box: unionBox(copies) }; showSel();
  }
  redrawBase(); markDirty(); updateUndo();
}

/* ---------- Anular / refazer ---------- */
function hist() { const id = page().id; if (!S.hist.has(id)) S.hist.set(id, { u: [], r: [] }); return S.hist.get(id); }
function pushHist(prev) { const h = hist(); h.u.push(prev); if (h.u.length > 80) h.u.shift(); h.r.length = 0; }
function undo() {
  if (S.act || D.act) return; const h = hist(); if (!h.u.length) return;
  if (isDoc()) { h.r.push(snap(page())); unsnap(page(), h.u.pop()); return afterDocEdit(); }
  h.r.push(page().strokes); page().strokes = h.u.pop(); afterEdit();
}
function redo() {
  if (S.act || D.act) return; const h = hist(); if (!h.r.length) return;
  if (isDoc()) { h.u.push(snap(page())); unsnap(page(), h.r.pop()); return afterDocEdit(); }
  h.u.push(page().strokes); page().strokes = h.r.pop(); afterEdit();
}
function afterEdit() { clearSel(); redrawBase(); markDirty(); updateUndo(); }
function updateUndo() { if (!S.nb) return; const h = hist(); $('#btnUndo').disabled = !h.u.length; $('#btnRedo').disabled = !h.r.length; }

/* ---------- Lápis, dedo e rato ---------- */
function pagePt(e, rect) { return [(e.clientX - rect.left) / S.scale, (e.clientY - rect.top) / S.scale]; }
function pressureOf(e) { if (e.pointerType !== 'pen') return 0.5; return e.pressure > 0 ? e.pressure : 0.5; }

function onDown(e) {
  if (!S.nb || e.target.closest('.selbar')) return;
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  e.preventDefault();
  try { stage.setPointerCapture(e.pointerId); } catch (_) {}
  if (e.pointerType === 'pen' && !S.penSeen) {
    S.penSeen = true; S.penOnly = true; saveSettings(); updatePenBtn();
    toast('Apple Pencil detetado: o lápis escreve e o dedo desloca a página.', 4000);
  }
  if (e.pointerType === 'touch') {
    S.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (S.act && S.act.pointerType === 'touch') { cancelAct(); return; }   // 2.º dedo: passa a deslocar
    if (S.penOnly || S.touches.size > 1) return;
  }
  if (S.act) return;
  startAct(e);
}
function startAct(e) {
  const pg = page(), rect = sheet.getBoundingClientRect();
  const [x, y] = pagePt(e, rect);
  if (x < -10 || y < -10 || x > PAGE_W + 10 || y > PAGE_H + 10) return false;
  const a = { id: e.pointerId, pointerType: e.pointerType, tool: S.tool, rect };
  if (S.tool === 'pen' || S.tool === 'hl') {
    clearSel();
    a.s = { id: uid(), tool: S.tool, color: S.tool === 'pen' ? S.penColor : S.hlColor, w: WIDTHS[S.tool][S.w[S.tool]], pts: [] };
    a.lastP = pressureOf(e);
    S.act = a; addPt(a, x, y, a.lastP, true);
  } else if (S.tool === 'eraser') {
    clearSel();
    a.before = pg.strokes; a.r = WIDTHS.eraser[S.w.eraser];
    S.act = a; stepAct(a, x, y, e); renderAct(a);
  } else if (S.tool === 'lasso') {
    if (S.sel && inBox(S.sel.box, x, y)) {
      Object.assign(a, { mode: 'drag', x0: x, y0: y, dx: 0, dy: 0 });
      S.act = a; redrawBase(S.sel.ids); $('#selBox').classList.add('hidden'); drawSelLive(0, 0);
    } else {
      clearSel(); a.mode = 'lasso'; a.poly = [[x, y]]; S.act = a;
    }
  }
  return true;
}
function addPt(a, x, y, raw, first) {
  const p = a.s.pts;
  const pr = first ? raw : a.lastP * 0.55 + raw * 0.45; a.lastP = pr;
  const q = [r1(x), r1(y), Math.round(pr * 100) / 100];
  if (p.length) { const l = p[p.length - 1]; if (Math.hypot(q[0] - l[0], q[1] - l[1]) < 0.7) return; }
  p.push(q);
  if (a.s.tool === 'hl') { drawStroke(clearCtx(cLive), a.s); return; }
  const x2 = ctxOf(cLive);
  x2.save(); x2.lineCap = 'round'; x2.strokeStyle = a.s.color; x2.fillStyle = a.s.color;
  if (p.length === 1) { x2.beginPath(); x2.arc(q[0], q[1], wAt(a.s, q[2]) / 2, 0, 7); x2.fill(); }
  else seg(x2, a.s, p, p.length - 1);
  x2.restore();
}
function stepAct(a, x, y, ev) {
  if (a.s) addPt(a, x, y, pressureOf(ev));
  else if (a.tool === 'eraser') {
    a.cx = x; a.cy = y;
    const pg = page(); let hit = false;
    const keep = pg.strokes.filter(s => { if (strokeHit(s, x, y, a.r)) { hit = true; return false; } return true; });
    if (hit) { pg.strokes = keep; a.changed = true; }
  }
  else if (a.mode === 'lasso') a.poly.push([x, y]);
  else if (a.mode === 'drag') { a.dx = x - a.x0; a.dy = y - a.y0; }
}
function renderAct(a) {
  if (a.tool === 'eraser') {
    if (a.changed) { redrawBase(); a.changed = false; }
    const x = clearCtx(cLive);
    x.save(); x.strokeStyle = 'rgba(80,90,110,.7)'; x.lineWidth = 1.2 / S.scale;
    x.beginPath(); x.arc(a.cx, a.cy, a.r, 0, 7); x.stroke(); x.restore();
  } else if (a.mode === 'lasso') drawLasso(a.poly);
  else if (a.mode === 'drag') drawSelLive(a.dx, a.dy);
}
function onMove(e) {
  const a = S.act;
  if (a && a.id === e.pointerId) {
    e.preventDefault();
    const co = e.getCoalescedEvents ? e.getCoalescedEvents() : null;
    const list = co && co.length ? co : [e];
    for (const ev of list) { const [x, y] = pagePt(ev, a.rect); stepAct(a, x, y, ev); }
    renderAct(a);
    return;
  }
  const t = S.touches.get(e.pointerId);
  if (e.pointerType === 'touch' && t) {
    e.preventDefault();
    const n = S.touches.size;
    stage.scrollLeft -= (e.clientX - t.x) / n; stage.scrollTop -= (e.clientY - t.y) / n;
    t.x = e.clientX; t.y = e.clientY;
  }
}
function onUp(e) {
  if (e.pointerType === 'touch') S.touches.delete(e.pointerId);
  const a = S.act; if (!a || a.id !== e.pointerId) return;
  S.act = null;
  const pg = page();
  clearCtx(cLive);
  if (a.s) {
    if (a.s.pts.length) {
      pushHist(pg.strokes); pg.strokes = pg.strokes.concat([a.s]);
      drawStroke(ctxOf(cBase), a.s); markDirty();
    }
  } else if (a.tool === 'eraser') {
    if (pg.strokes !== a.before) { pushHist(a.before); markDirty(); }
  } else if (a.mode === 'lasso') {
    selectPoly(a.poly);
  } else if (a.mode === 'drag') {
    if (Math.abs(a.dx) + Math.abs(a.dy) > 0.5) {
      pushHist(pg.strokes);
      pg.strokes = pg.strokes.map(s => S.sel.ids.has(s.id) ? moved(s, a.dx, a.dy) : s);
      S.sel.box = { ...S.sel.box, x: S.sel.box.x + a.dx, y: S.sel.box.y + a.dy };
      markDirty();
    }
    redrawBase(); showSel();
  }
  updateUndo();
}
function onCancel(e) {
  if (e.pointerType === 'touch') S.touches.delete(e.pointerId);
  if (S.act && S.act.id === e.pointerId) cancelAct();
}
function cancelAct() {
  const a = S.act; S.act = null; if (!a) return;
  clearCtx(cLive);
  if (a.tool === 'eraser' && a.before) { page().strokes = a.before; redrawBase(); }
  if (a.mode === 'drag') { redrawBase(); showSel(); }
}
stage.addEventListener('pointerdown', onDown);
stage.addEventListener('pointermove', onMove);
stage.addEventListener('pointerup', onUp);
stage.addEventListener('pointercancel', onCancel);
stage.addEventListener('contextmenu', e => e.preventDefault());
stage.addEventListener('touchstart', e => { if (!e.target.closest('.selbar')) e.preventDefault(); }, { passive: false });
document.querySelectorAll('.selbar button').forEach(b => b.addEventListener('click', () => selAction(b.dataset.sel)));

/* ---------- Gravação automática ---------- */
function markDirty(id = page() && page().id) {
  if (id) S.dirtyPages.add(id);
  S.dirty = true;
  clearTimeout(S.saveT); S.saveT = setTimeout(flush, 600);
}
async function flush() {
  clearTimeout(S.saveT);
  if (!S.dirty || !S.nb) return;
  S.dirty = false;
  const ids = [...S.dirtyPages]; S.dirtyPages.clear();
  try {
    for (const id of ids) { const p = S.pages.find(x => x.id === id); if (p) await DB.put('pages', p); }
    S.nb.updated = Date.now(); S.nb.lastPage = S.idx; S.nb.pages = S.pages.map(p => p.id);
    await DB.put('notebooks', S.nb);
    if (ids.length) noteChange();
  } catch (err) {
    ids.forEach(id => S.dirtyPages.add(id)); S.dirty = true;
    toast('Não foi possível guardar. Verifica o espaço livre no iPad.', 5000);
  }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
window.addEventListener('pagehide', flush);
