'use strict';
/* Caderno Digital — base: constantes, armazenamento (IndexedDB), estado e janelas
   Powered by Claude IA & Ideias&Soltas — concepção de produtos multimédia */

const PAGE_W = 1000, PAGE_H = 1414;           // proporção A4
const PEN_COLORS = ['#1a1a1a','#1f5fbf','#d0312d','#2e8b57','#7b4fa0','#e8743b'];
const HL_COLORS  = ['#ffe066','#9be89b','#ffb3d1','#9ad7ff','#ffc78a'];
const WIDTHS = { pen:[1.6,3,5.5], hl:[14,22,34], eraser:[8,18,36] };
const COVERS = ['#1f3a5f','#2e7d5b','#b5452f','#7b4fa0','#c98a1b','#3d6fb6','#4b5563','#0f766e'];
const BGS = [['liso','Liso'],['pautado','Pautado'],['quadriculado','Quadriculado'],['pontilhado','Pontilhado']];
const SETTINGS_KEY = 'cd-settings-v1';

const $ = s => document.querySelector(s);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const r1 = v => Math.round(v * 10) / 10;
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmtDate = ts => new Date(ts).toLocaleDateString('pt-PT', {day:'2-digit', month:'2-digit', year:'numeric'});
const safeName = s => (s || 'caderno').replace(/[^\p{L}\p{N}\- ]/gu, '').trim().replace(/\s+/g, '-') || 'caderno';

/* ---------- Armazenamento local (IndexedDB) ---------- */
const DB = (() => {
  let dbp = null, memory = false;
  const mem = { notebooks: new Map(), pages: new Map() };
  function open() {
    if (dbp) return dbp;
    dbp = new Promise(res => {
      let req;
      try { req = indexedDB.open('caderno-digital', 1); } catch (e) { memory = true; return res(null); }
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('notebooks')) db.createObjectStore('notebooks', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('pages')) db.createObjectStore('pages', { keyPath: 'id' });
      };
      req.onsuccess = () => res(req.result);
      req.onerror = () => { memory = true; res(null); };
      req.onblocked = () => { memory = true; res(null); };
    });
    return dbp;
  }
  async function run(store, mode, idbOp, memOp) {
    const db = await open();
    if (!db) return memOp(mem[store]);
    return new Promise((res, rej) => {
      const t = db.transaction(store, mode);
      const r = idbOp(t.objectStore(store));
      t.oncomplete = () => res(r.result);
      t.onerror = () => rej(t.error);
      t.onabort = () => rej(t.error);
    });
  }
  return {
    get memory() { return memory; },
    ready: () => open(),
    get: (st, id) => run(st, 'readonly',  s => s.get(id),    m => m.get(id)),
    all: (st)     => run(st, 'readonly',  s => s.getAll(),   m => [...m.values()]),
    put: (st, o)  => run(st, 'readwrite', s => s.put(o),     m => { m.set(o.id, o); }),
    del: (st, id) => run(st, 'readwrite', s => s.delete(id), m => { m.delete(id); }),
  };
})();

/* ---------- Estado ---------- */
const S = {
  nb: null, pages: [], idx: 0,
  tool: 'pen', penColor: PEN_COLORS[1], hlColor: HL_COLORS[0], w: { pen: 1, hl: 1, eraser: 1 },
  penOnly: false, penSeen: false,
  fit: 'width', scale: 1, px: 1,
  hist: new Map(), sel: null, act: null, touches: new Map(),
  dirty: false, dirtyPages: new Set(), saveT: null
};
function loadSettings() {
  try {
    const o = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    for (const k of ['tool','penColor','hlColor','w','penOnly','penSeen','fit']) if (k in o) S[k] = o[k];
  } catch (e) {}
  if (!['pen','hl','eraser'].includes(S.tool)) S.tool = 'pen';
  if (!['width','page'].includes(S.fit)) S.fit = 'width';
}
function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({
      tool: S.tool === 'lasso' ? 'pen' : S.tool, penColor: S.penColor, hlColor: S.hlColor, w: S.w,
      penOnly: S.penOnly, penSeen: S.penSeen, fit: S.fit === 'custom' ? 'width' : S.fit }));
  } catch (e) {}
}
const page = () => S.pages[S.idx];
const newPage = (nbId, bg) => ({ id: uid(), nb: nbId, kind: 'ink', parent: null, bg: bg || 'pautado', strokes: [] });
const newDoc = (nbId, parent) => ({ id: uid(), nb: nbId, kind: 'doc', parent: parent || null, title: '', icon: '📄', blocks: [{ id: uid(), type: 'p', html: '' }] });
const isDoc = () => !!(S.nb && page() && page().kind === 'doc');
const pageName = p => p.kind === 'doc' ? (p.title || 'Sem título') : (p.title || `Página ${S.pages.indexOf(p) + 1}`);
function depthOf(p) {
  let d = 0, q = p; const seen = new Set();
  while (q && q.parent && !seen.has(q.parent)) { seen.add(q.parent); q = S.pages.find(x => x.id === q.parent); if (!q) break; d++; }
  return d;
}
function subtreeEnd(i) {                 // posição a seguir à página i e a todas as suas subpáginas
  const d = depthOf(S.pages[i]); let j = i + 1;
  while (j < S.pages.length && depthOf(S.pages[j]) > d) j++;
  return j;
}

/* ---------- Utilitários de interface ---------- */
function toast(msg, ms = 2800) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), ms);
}
function modal(html, mount, cls = '') {
  return new Promise(res => {
    const ov = document.createElement('div'); ov.className = 'ov';
    ov.innerHTML = `<div class="mdl ${cls}">${html}</div>`;
    document.body.appendChild(ov);
    let done = false;
    const close = v => { if (done) return; done = true; ov.remove(); res(v); };
    ov.addEventListener('click', e => { if (e.target === ov) close(null); });
    ov.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => close(null)));
    if (mount) mount(ov.firstElementChild, close);
  });
}
function askText(title, value = '', ok = 'Guardar') {
  return modal(`<h2>${esc(title)}</h2><input type="text" id="mIn" value="${esc(value)}" maxlength="80">
    <div class="acts"><button class="btn" data-close>Cancelar</button><button class="btn primary" id="mOk">${esc(ok)}</button></div>`,
    (m, close) => {
      const i = m.querySelector('#mIn'); setTimeout(() => { i.focus(); i.select(); }, 60);
      const go = () => { const v = i.value.trim(); if (v) close(v); };
      m.querySelector('#mOk').onclick = go; i.onkeydown = e => { if (e.key === 'Enter') go(); };
    });
}
function confirmBox(title, msg, ok = 'Apagar', danger = true) {
  return modal(`<h2>${esc(title)}</h2><p>${esc(msg)}</p>
    <div class="acts"><button class="btn" data-close>Cancelar</button><button class="btn ${danger ? 'danger' : 'primary'}" id="mOk">${esc(ok)}</button></div>`,
    (m, close) => { m.querySelector('#mOk').onclick = () => close(true); }).then(v => !!v);
}
function actionSheet(title, items) {
  return modal(`<h2>${esc(title)}</h2><div class="list">${items.map((it, i) =>
      `<button data-i="${i}"${it.danger ? ' style="color:#b42318"' : ''}>${esc(it.label)}</button>`).join('')}</div>
    <div class="acts"><button class="btn" data-close>Fechar</button></div>`,
    (m, close) => m.querySelectorAll('.list button').forEach(b => b.onclick = () => close(items[+b.dataset.i].value)));
}
function pickColor(title, current) {
  return modal(`<h2>${esc(title)}</h2><div class="colors">${COVERS.map(c =>
      `<button data-c="${c}" class="${c === current ? 'on' : ''}" style="background:${c}"></button>`).join('')}</div>
    <div class="acts"><button class="btn" data-close>Cancelar</button></div>`,
    (m, close) => m.querySelectorAll('.colors button').forEach(b => b.onclick = () => close(b.dataset.c)));
}
