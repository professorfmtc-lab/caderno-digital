'use strict';
/* Caderno Digital — fase 2: páginas de blocos (à maneira do Notion)
   Powered by Claude IA & Ideias&Soltas — concepção de produtos multimédia */

/* =========================================================
   FASE 2 — Páginas de blocos (à maneira do Notion)
   ========================================================= */
const docView = $('#docView'), docEl = $('#doc'), fmtBar = $('#fmt');
const TEXT_T = new Set(['p', 'h1', 'h2', 'h3', 'ul', 'ol', 'todo', 'quote', 'callout']);
const PH = { p: 'Escreve, ou / para inserir blocos', h1: 'Título 1', h2: 'Título 2', h3: 'Título 3', ul: 'Lista', ol: 'Lista', todo: 'Tarefa', quote: 'Citação', callout: 'Escreve uma nota' };
const ICONS = ['📄','📘','📗','📕','📒','📓','🗺️','🌍','🌋','🏔️','🌦️','🌱','🌊','🏙️','🚢','🌾','📊','📈','🧭','✏️','📝','📌','⭐','💡','🎓','🏫','👥','📅'];
const CALLOUT_EMO = ['💡', '⚠️', '📌', '✅', '❗', '📝', '🌍'];
const MENU = [
  { t: 'p', l: 'Texto', i: 'T', k: 'texto paragrafo normal' },
  { t: 'h1', l: 'Título 1', i: 'H1', k: 'titulo cabecalho grande' },
  { t: 'h2', l: 'Título 2', i: 'H2', k: 'titulo subtitulo cabecalho' },
  { t: 'h3', l: 'Título 3', i: 'H3', k: 'titulo cabecalho' },
  { t: 'ul', l: 'Lista com marcas', i: '•', k: 'lista marcas pontos' },
  { t: 'ol', l: 'Lista numerada', i: '1.', k: 'lista numerada numeros' },
  { t: 'todo', l: 'Lista de tarefas', i: '☑', k: 'tarefas checklist todo verificar' },
  { t: 'quote', l: 'Citação', i: '❝', k: 'citacao' },
  { t: 'callout', l: 'Destaque', i: '💡', k: 'destaque nota aviso caixa' },
  { t: 'divider', l: 'Divisória', i: '—', k: 'divisoria linha separador' },
  { t: 'draw', l: 'Desenho à mão', i: '✎', k: 'desenho mao lapis caneta escrita manuscrito esboco' },
  { t: 'table', l: 'Tabela', i: '▦', k: 'tabela grelha' },
  { t: 'img', l: 'Imagem', i: '🖼', k: 'imagem foto fotografia camara' },
  { t: 'subdoc', l: 'Subpágina de blocos', i: '📄', k: 'subpagina pagina filha blocos' },
  { t: 'subink', l: 'Subpágina manuscrita', i: '📓', k: 'subpagina manuscrita caderno lapis' },
  { t: 'link', l: 'Ligação a página', i: '↗', k: 'ligacao link pagina' }
];
const MD = [['###', 'h3'], ['##', 'h2'], ['#', 'h1'], ['-', 'ul'], ['*', 'ul'], ['•', 'ul'], ['1.', 'ol'], ['[]', 'todo'], ['[ ]', 'todo'], ['>', 'quote']];
const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const D = { act: null, slash: null, typeSnapT: 0, touches: new Map(), w: 0 };
const snap = p => JSON.stringify({ title: p.title, icon: p.icon, blocks: p.blocks });
const unsnap = (p, s) => Object.assign(p, JSON.parse(s));
const blkOf = id => page().blocks.find(b => b.id === id);
const bIndex = id => page().blocks.findIndex(b => b.id === id);
function docPush() { pushHist(snap(page())); D.typeSnapT = 0; updateUndo(); }
function afterDocEdit() { closeSlash(); hideFmt(); renderDoc(); markDirty(); updateUndo(); }

/* ---- limpeza do HTML (só formatação simples) ---- */
const KEEP = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'BR', 'SPAN', 'FONT']);
const STYLE_OK = ['color', 'background-color', 'font-weight', 'font-style', 'text-decoration', 'text-decoration-line'];
function clean(html) {
  const t = document.createElement('template'); t.innerHTML = html || '';
  (function walk(n) {
    for (const c of [...n.childNodes]) {
      if (c.nodeType === 3) continue;
      if (c.nodeType !== 1) { c.remove(); continue; }
      if (/^(SCRIPT|STYLE|IFRAME|OBJECT|EMBED|SVG|MATH|TEMPLATE|IMG|VIDEO|AUDIO|LINK|META)$/i.test(c.tagName)) { c.remove(); continue; }
      walk(c);
      if (!KEEP.has(c.tagName)) {
        if (/^(DIV|P|LI|H\d)$/.test(c.tagName) && c.previousSibling) c.before(document.createElement('br'));
        c.replaceWith(...c.childNodes); continue;
      }
      const keep = STYLE_OK.map(k => [k, c.style.getPropertyValue(k)]).filter(([, v]) => v);
      for (const a of [...c.attributes]) if (!(a.name === 'color' && c.tagName === 'FONT')) c.removeAttribute(a.name);
      keep.forEach(([k, v]) => c.style.setProperty(k, v));
    }
  })(t.content);
  return t.innerHTML;
}

/* ---- cursor ---- */
function textPos(el, n) {
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let t;
  while ((t = w.nextNode())) { if (n <= t.length) return [t, n]; n -= t.length; }
  return [el, el.childNodes.length];
}
function setCaret(el, n) {
  const [node, off] = textPos(el, n), r = document.createRange();
  r.setStart(node, off); r.collapse(true);
  const s = getSelection(); s.removeAllRanges(); s.addRange(r);
}
function caretOf(el) {
  const s = getSelection(); if (!s.rangeCount) return -1;
  const r = s.getRangeAt(0); if (!el.contains(r.endContainer)) return -1;
  const pre = document.createRange(); pre.selectNodeContents(el); pre.setEnd(r.endContainer, r.endOffset);
  return pre.toString().length;
}
const atStart = el => getSelection().isCollapsed && caretOf(el) === 0;
function caretRect() {
  const s = getSelection(); if (!s.rangeCount) return null;
  const r = s.getRangeAt(0).cloneRange(); r.collapse(true);
  const rc = r.getClientRects(); return rc.length ? rc[0] : null;
}
function onFirstLine(el) {
  if (!el.textContent) return true;
  const rc = caretRect(); if (!rc) return caretOf(el) === 0;
  return rc.top - el.getBoundingClientRect().top < rc.height * 0.9 + 5;
}
function onLastLine(el) {
  if (!el.textContent) return true;
  const rc = caretRect(); if (!rc) return caretOf(el) === el.textContent.length;
  return el.getBoundingClientRect().bottom - rc.bottom < rc.height * 0.9 + 5;
}
function deleteRange(el, a, z) {
  const [n1, o1] = textPos(el, a), [n2, o2] = textPos(el, z), r = document.createRange();
  r.setStart(n1, o1); r.setEnd(n2, o2); r.deleteContents();
}
function focusBlock(id, pos = 'end') {
  const host = docEl.querySelector(`.blk[data-id="${id}"]`); if (!host) return;
  const el = host.querySelector('.ce.main') || host.querySelector('.ce'); if (!el) return;
  el.focus({ preventScroll: true });
  const len = el.textContent.length;
  setCaret(el, pos === 'start' ? 0 : pos === 'end' ? len : Math.min(pos, len));
  ensureVisible();
}
function focusTitleEnd() { const t = $('#docTitle'); if (!t) return; t.focus(); setCaret(t, t.textContent.length); }
function focusPrevText(i) {
  const bl = page().blocks;
  for (let j = i - 1; j >= 0; j--) if (TEXT_T.has(bl[j].type)) return focusBlock(bl[j].id, 'end');
  focusTitleEnd();
}
function focusNextText(i) {
  const bl = page().blocks;
  for (let j = i + 1; j < bl.length; j++) if (TEXT_T.has(bl[j].type)) return focusBlock(bl[j].id, 'start');
}
function ensureVisible() {
  const rc = caretRect(); if (!rc || !rc.height) return;
  const vv = window.visualViewport, bottom = vv ? vv.height + vv.offsetTop : innerHeight;
  const dvr = docView.getBoundingClientRect(), limit = Math.min(bottom, dvr.bottom) - 48;
  if (rc.bottom > limit) docView.scrollTop += rc.bottom - limit;
  else if (rc.top < dvr.top + 10) docView.scrollTop -= dvr.top + 10 - rc.top;
}
if (window.visualViewport) visualViewport.addEventListener('resize', () => { if (isDoc() && docView.contains(document.activeElement)) ensureVisible(); });

/* ---- desenho dos blocos ---- */
function blockHTML(b, n) {
  const hdl = '<div class="hdl"><button class="h-add" title="Inserir bloco abaixo">+</button><button class="h-mnu" title="Opções do bloco">⋮⋮</button></div>';
  const ce = (cls, html, ph) => `<div class="ce ${cls}" contenteditable="true" data-ph="${esc(ph)}">${clean(html)}</div>`;
  let inner = '';
  if (TEXT_T.has(b.type)) {
    let mk = '';
    if (b.type === 'ul') mk = '<span class="mk">•</span>';
    else if (b.type === 'ol') mk = `<span class="mk">${n}.</span>`;
    else if (b.type === 'todo') mk = `<button class="chkb${b.checked ? ' on' : ''}" title="Marcar como feita">${b.checked ? '✓' : ''}</button>`;
    else if (b.type === 'callout') mk = `<button class="emo" title="Mudar o símbolo">${esc(b.emoji || '💡')}</button>`;
    inner = mk + ce('main', b.html, PH[b.type]);
  } else if (b.type === 'divider') inner = '<hr class="div">';
  else if (b.type === 'draw') inner = '<div class="draw"><canvas></canvas><div class="rsz">⋯ arrasta aqui para mudar a altura ⋯</div></div>';
  else if (b.type === 'table') inner = `<div style="width:100%"><div class="tblw"><table>${b.rows.map((r, ri) => '<tr>' + r.map((c, ci) =>
      `<td><div class="ce cell" contenteditable="true" data-r="${ri}" data-c="${ci}">${clean(c)}</div></td>`).join('') + '</tr>').join('')}</table></div>
      <div class="tbtns"><button data-a="r+">+ Linha</button><button data-a="c+">+ Coluna</button><button data-a="r-">− Linha</button><button data-a="c-">− Coluna</button></div></div>`;
  else if (b.type === 'img') inner = `<figure class="fig"><img src="${esc(b.src)}" alt="">${ce('cap', b.caption || '', 'Legenda (opcional)')}</figure>`;
  else if (b.type === 'link') {
    const q = S.pages.find(x => x.id === b.target);
    inner = q ? `<button class="plink" data-go="${q.id}">${esc(q.kind === 'doc' ? (q.icon || '📄') : '📓')} ${esc(pageName(q))}</button>` : '<button class="plink gone">Página apagada</button>';
  }
  return `<div class="blk t-${b.type}${b.type === 'todo' && b.checked ? ' done' : ''}" data-id="${b.id}">${hdl}<div class="bc">${inner}</div></div>`;
}
function renderDoc(focus) {
  const p = page(); if (!p || p.kind !== 'doc') return;
  closeSlash();
  if (!Array.isArray(p.blocks) || !p.blocks.length) p.blocks = [{ id: uid(), type: 'p', html: '' }];
  let n = 0;
  const parts = p.blocks.map(b => { n = b.type === 'ol' ? n + 1 : 0; return blockHTML(b, n); });
  docEl.innerHTML = `<div class="doc-head"><button class="doc-icon" id="docIcon" title="Mudar o ícone">${esc(p.icon || '📄')}</button>
    <div class="doc-title" contenteditable="true" data-ph="Sem título" id="docTitle">${esc(p.title || '')}</div></div>`
    + parts.join('') + '<div id="docEnd" style="height:140px;cursor:text"></div>';
  docEl.querySelectorAll('.draw').forEach(setupDraw);
  D.w = docEl.clientWidth;
  if (focus) focusBlock(focus.id, focus.pos);
}
function syncCE(el) {
  if (el.id === 'docTitle') { page().title = el.textContent; if (!el.textContent && el.innerHTML) el.innerHTML = ''; markDirty(); return; }
  const host = el.closest('.blk'); const b = host && blkOf(host.dataset.id); if (!b) return;
  if (!el.textContent && el.innerHTML !== '') el.innerHTML = '';
  if (el.classList.contains('main')) b.html = el.innerHTML;
  else if (el.classList.contains('cap')) b.caption = el.innerHTML;
  else if (el.classList.contains('cell')) b.rows[+el.dataset.r][+el.dataset.c] = el.innerHTML;
  markDirty();
}

/* ---- Enter, apagar e atalhos ---- */
function onEnter(el) {
  const b = blkOf(el.closest('.blk').dataset.id); if (!b) return;
  const p = page(), i = bIndex(b.id);
  docPush();
  if (['ul', 'ol', 'todo', 'quote', 'callout'].includes(b.type) && !el.textContent) {   // item vazio: sai da lista
    b.type = 'p'; delete b.checked; renderDoc({ id: b.id, pos: 'start' }); markDirty(); return;
  }
  let tail = '';
  const s = getSelection();
  if (s.rangeCount && el.contains(s.getRangeAt(0).startContainer)) {
    const r = s.getRangeAt(0); r.deleteContents();
    const t = document.createRange(); t.selectNodeContents(el); t.setStart(r.endContainer, r.endOffset);
    const tmp = document.createElement('div'); tmp.appendChild(t.extractContents());
    tail = tmp.textContent ? tmp.innerHTML : '';
  }
  b.html = el.textContent ? el.innerHTML : '';
  const same = ['ul', 'ol', 'todo'].includes(b.type);
  const nb = { id: uid(), type: same ? b.type : 'p', html: tail }; if (nb.type === 'todo') nb.checked = false;
  p.blocks.splice(i + 1, 0, nb);
  renderDoc({ id: nb.id, pos: 'start' }); markDirty();
}
function onBackspaceStart(el) {
  const b = blkOf(el.closest('.blk').dataset.id); if (!b) return;
  const p = page(), i = bIndex(b.id);
  if (b.type !== 'p') { docPush(); b.type = 'p'; delete b.checked; renderDoc({ id: b.id, pos: 'start' }); markDirty(); return; }
  if (i === 0) {
    if (!el.textContent && p.blocks.length > 1) { docPush(); p.blocks.splice(0, 1); renderDoc(); markDirty(); }
    focusTitleEnd(); return;
  }
  const prev = p.blocks[i - 1];
  if (TEXT_T.has(prev.type)) {
    docPush();
    const len = plainText(clean(prev.html || '')).length;
    prev.html = (len ? prev.html : '') + (el.textContent ? el.innerHTML : '');
    p.blocks.splice(i, 1);
    renderDoc({ id: prev.id, pos: len }); markDirty();
  } else if (!el.textContent) {                     // linha vazia a seguir a desenho/tabela/imagem
    docPush(); p.blocks.splice(i, 1); renderDoc(); focusPrevText(i); markDirty();
  }
}
function titleEnter() {
  const p = page(), f = p.blocks[0];
  if (f && f.type === 'p' && !plainText(f.html || '')) return focusBlock(f.id, 'start');
  docPush(); const nb = { id: uid(), type: 'p', html: '' }; p.blocks.unshift(nb);
  renderDoc({ id: nb.id, pos: 'start' }); markDirty();
}
function cellEnter(el) {
  const b = blkOf(el.closest('.blk').dataset.id); if (!b) return;
  const r = +el.dataset.r, c = +el.dataset.c;
  if (r === b.rows.length - 1) { docPush(); b.rows.push(b.rows[0].map(() => '')); renderDoc(); markDirty(); }
  const nx = docEl.querySelector(`.blk[data-id="${b.id}"] .cell[data-r="${r + 1}"][data-c="${c}"]`);
  if (nx) { nx.focus(); setCaret(nx, nx.textContent.length); ensureVisible(); }
}
function mdShortcut(el, b) {
  if (b.type !== 'p') return;
  const c = caretOf(el), txt = el.textContent;
  for (const [pre, t] of MD) {
    if (c === pre.length + 1 && txt.startsWith(pre) && /\s/.test(txt[pre.length])) {
      docPush(); deleteRange(el, 0, c); b.html = el.textContent ? el.innerHTML : '';
      b.type = t; if (t === 'todo') b.checked = false;
      renderDoc({ id: b.id, pos: 'start' }); markDirty(); return;
    }
  }
}
function focusEndOfDoc() {
  const p = page(), last = p.blocks[p.blocks.length - 1];
  if (last && last.type === 'p' && !plainText(last.html || '')) return focusBlock(last.id, 'start');
  docPush(); const nb = { id: uid(), type: 'p', html: '' }; p.blocks.push(nb);
  renderDoc({ id: nb.id, pos: 'start' }); markDirty();
}

/* ---- menu "/" ---- */
function maybeOpenSlash(el, b) {
  const c = caretOf(el), t = el.textContent;
  if (c < 1 || t[c - 1] !== '/' || (c > 1 && !/\s/.test(t[c - 2]))) return;
  openSlash({ el, id: b.id, start: c - 1, mode: 'slash' });
}
function openSlash(o) {
  closeSlash();
  D.slash = Object.assign(o, { q: '', sel: 0 });
  const m = document.createElement('div'); m.id = 'slash'; docEl.appendChild(m);
  m.addEventListener('pointerdown', e => e.preventDefault());       // mantém o cursor no bloco
  m.addEventListener('mousedown', e => e.preventDefault());
  D.slash.m = m;
  const host = docEl.querySelector(`.blk[data-id="${o.id}"]`);
  m.style.top = (host.offsetTop + host.offsetHeight + 4) + 'px';
  drawSlash();
  const r = m.getBoundingClientRect(), dvr = docView.getBoundingClientRect();
  const vv = window.visualViewport, bottom = Math.min(dvr.bottom, vv ? vv.height + vv.offsetTop : innerHeight);
  if (r.bottom > bottom - 8) docView.scrollTop += r.bottom - bottom + 8;
}
function slashItems() { const q = norm(D.slash.q.trim()); return MENU.filter(it => !q || norm(it.l).includes(q) || it.k.includes(q)); }
function drawSlash() {
  const s = D.slash, items = slashItems(); s.items = items;
  if (!items.length) { s.m.innerHTML = '<div class="shd">Sem resultados</div>'; return; }
  s.sel = clamp(s.sel, 0, items.length - 1);
  s.m.innerHTML = '<div class="shd">Inserir bloco</div>' + items.map((it, i) =>
    `<button class="si${i === s.sel ? ' on' : ''}" data-i="${i}"><b>${it.i}</b>${esc(it.l)}</button>`).join('');
  s.m.querySelectorAll('.si').forEach(b => b.onclick = () => { s.sel = +b.dataset.i; chooseSlash(); });
  const on = s.m.querySelector('.si.on');
  if (on) { const top = on.offsetTop, bot = top + on.offsetHeight; if (top < s.m.scrollTop) s.m.scrollTop = top - 30; else if (bot > s.m.scrollTop + s.m.clientHeight) s.m.scrollTop = bot - s.m.clientHeight + 6; }
}
function updateSlash() {
  const s = D.slash, el = s.el, c = caretOf(el), t = el.textContent;
  if (c <= s.start || t[s.start] !== '/') return closeSlash();
  s.q = t.slice(s.start + 1, c);
  if (s.q.length > 24 || (/\s$/.test(s.q) && !slashItems().length)) return closeSlash();
  s.sel = 0; drawSlash();
}
function moveSlash(d) { const s = D.slash; if (!s.items || !s.items.length) return; s.sel = (s.sel + d + s.items.length) % s.items.length; drawSlash(); }
function closeSlash() { if (D.slash && D.slash.m) D.slash.m.remove(); D.slash = null; }
async function chooseSlash() {
  const s = D.slash; if (!s) return;
  const it = s.items && s.items[s.sel];
  const b = blkOf(s.id);
  if (!it || !b) return closeSlash();
  docPush();
  let replace;
  if (s.mode === 'slash') {
    deleteRange(s.el, s.start, s.start + 1 + s.q.length);
    b.html = s.el.textContent ? s.el.innerHTML : '';
    replace = !s.el.textContent;
  } else replace = TEXT_T.has(b.type) && !plainText(b.html || '');
  closeSlash();
  await applyBlock(it.t, b, replace);
}
async function applyBlock(t, b, replace) {
  const p = page(), TEXT = TEXT_T.has(t);
  if (TEXT && replace) {
    b.type = t; if (t === 'todo') b.checked = false; if (t === 'callout') b.emoji = b.emoji || '💡';
    renderDoc({ id: b.id, pos: 'end' }); markDirty(); return;
  }
  let nb;
  if (TEXT) { nb = { id: uid(), type: t, html: '' }; if (t === 'todo') nb.checked = false; if (t === 'callout') nb.emoji = '💡'; }
  else if (t === 'divider') nb = { id: uid(), type: 'divider' };
  else if (t === 'draw') nb = { id: uid(), type: 'draw', h: 420, bg: 'liso', strokes: [] };
  else if (t === 'table') nb = { id: uid(), type: 'table', rows: [['', '', ''], ['', '', ''], ['', '', '']] };
  else if (t === 'img') { const src = await pickImage(); if (!src) return renderDoc(); nb = { id: uid(), type: 'img', src, caption: '' }; }
  else if (t === 'link') { const target = await pickPage(); if (!target) return renderDoc(); nb = { id: uid(), type: 'link', target }; }
  else if (t === 'subdoc' || t === 'subink') {
    const child = t === 'subdoc' ? newDoc(S.nb.id, p.id) : Object.assign(newPage(S.nb.id, S.nb.bg || 'pautado'), { parent: p.id });
    const at = subtreeEnd(S.idx);
    S.pages.splice(at, 0, child); markDirty(child.id);
    nb = { id: uid(), type: 'link', target: child.id };
    const i = bIndex(b.id);
    if (replace) p.blocks.splice(i, 1, nb); else p.blocks.splice(i + 1, 0, nb);
    markDirty(p.id); await flush();
    goPage(at); toast(t === 'subdoc' ? 'Subpágina criada (a ligação ficou na página de cima)' : 'Subpágina manuscrita criada');
    if (t === 'subdoc') setTimeout(focusTitleEnd, 50);
    return;
  }
  const i = bIndex(b.id);
  if (replace) p.blocks.splice(i, 1, nb); else p.blocks.splice(i + 1, 0, nb);
  let focus = TEXT ? { id: nb.id, pos: 'start' } : null;
  if (!TEXT) {                                      // garante uma linha de texto a seguir
    const j = bIndex(nb.id), nx = p.blocks[j + 1];
    if (!nx || !TEXT_T.has(nx.type)) { const q = { id: uid(), type: 'p', html: '' }; p.blocks.splice(j + 1, 0, q); if (t === 'divider' || t === 'img' || t === 'link') focus = { id: q.id, pos: 'start' }; }
  }
  renderDoc(focus); markDirty();
  if (t === 'table') { const c0 = docEl.querySelector(`.blk[data-id="${nb.id}"] .cell`); if (c0) c0.focus(); }
}
function pickImage() {
  return new Promise(res => {
    const inp = $('#fileImg'); inp.value = '';
    inp.onchange = async () => {
      const f = inp.files[0]; if (!f) return res(null);
      try { res(await shrinkImage(f)); } catch (e) { toast('Não foi possível ler a imagem.'); res(null); }
    };
    inp.oncancel = () => res(null);
    inp.click();
  });
}
async function shrinkImage(f) {
  const url = URL.createObjectURL(f);
  try {
    const img = new Image(); img.src = url; await img.decode();
    const k = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.85);
  } finally { URL.revokeObjectURL(url); }
}
async function pickPage() {
  const cur = page(), list = S.pages.filter(q => q !== cur);
  if (!list.length) { toast('Ainda não há outras páginas neste caderno.'); return null; }
  return actionSheet('Ligar a que página?', list.map(q => ({ label: `${'   '.repeat(depthOf(q))}${q.kind === 'doc' ? (q.icon || '📄') : '📓'}  ${pageName(q)}`, value: q.id })));
}
async function pickIcon() {
  const p = page();
  const v = await modal(`<h2>Ícone da página</h2><div style="display:flex;flex-wrap:wrap;gap:4px">${ICONS.map(i =>
      `<button data-e="${i}" style="width:50px;height:50px;font-size:28px;border-radius:10px">${i}</button>`).join('')}</div>
    <div class="acts"><button class="btn" data-close>Cancelar</button></div>`,
    (m, close) => m.querySelectorAll('[data-e]').forEach(b => b.onclick = () => close(b.dataset.e)));
  if (!v) return;
  docPush(); p.icon = v; renderDoc(); markDirty(); renderTree();
}
async function blockMenu(b) {
  const items = [];
  if (TEXT_T.has(b.type)) items.push({ label: 'Transformar em…', value: 'turn' });
  if (b.type === 'draw') items.push({ label: 'Papel do desenho', value: 'paper' }, { label: 'Limpar o desenho', value: 'clear' });
  items.push({ label: 'Mover para cima', value: 'up' }, { label: 'Mover para baixo', value: 'down' },
    { label: 'Duplicar', value: 'dup' }, { label: 'Apagar bloco', value: 'del', danger: true });
  const v = await actionSheet('Bloco', items); if (!v) return;
  const p = page(), i = bIndex(b.id); if (i < 0) return;
  if (v === 'turn') {
    const t = await actionSheet('Transformar em', MENU.filter(m => TEXT_T.has(m.t)).map(m => ({ label: `${m.i}   ${m.l}`, value: m.t })));
    if (!t) return; docPush(); b.type = t;
    if (t === 'todo' && b.checked === undefined) b.checked = false; if (t === 'callout') b.emoji = b.emoji || '💡';
  } else if (v === 'paper') {
    const bg = await actionSheet('Papel do desenho', BGS.map(([k, l]) => ({ label: l, value: k }))); if (!bg) return;
    docPush(); b.bg = bg;
  } else if (v === 'clear') { docPush(); b.strokes = []; }
  else if (v === 'up') { if (i === 0) return; docPush(); p.blocks.splice(i - 1, 0, p.blocks.splice(i, 1)[0]); }
  else if (v === 'down') { if (i >= p.blocks.length - 1) return; docPush(); p.blocks.splice(i + 1, 0, p.blocks.splice(i, 1)[0]); }
  else if (v === 'dup') { docPush(); const c = JSON.parse(JSON.stringify(b)); c.id = uid(); p.blocks.splice(i + 1, 0, c); }
  else if (v === 'del') { docPush(); p.blocks.splice(i, 1); }
  renderDoc(); markDirty();
}
function tableAct(b, a) {
  const R = b.rows.length, C = b.rows[0].length;
  if ((a === 'r-' && R <= 1) || (a === 'c-' && C <= 1)) return;
  docPush();
  if (a === 'r+') b.rows.push(Array(C).fill(''));
  else if (a === 'c+') b.rows.forEach(r => r.push(''));
  else if (a === 'r-') b.rows.pop();
  else if (a === 'c-') b.rows.forEach(r => r.pop());
  renderDoc(); markDirty();
}

/* ---- eventos da página de blocos ---- */
const ceOf = e => e.target && e.target.closest ? e.target.closest('[contenteditable]') : null;
docView.addEventListener('beforeinput', e => {
  const el = ceOf(e); if (!el) return;
  const it = e.inputType;
  if (it === 'historyUndo') { e.preventDefault(); return undo(); }
  if (it === 'historyRedo') { e.preventDefault(); return redo(); }
  if (it === 'insertParagraph') {
    e.preventDefault();
    if (D.slash && D.slash.el === el) return chooseSlash();
    if (el.id === 'docTitle') return titleEnter();
    if (el.classList.contains('cell')) return cellEnter(el);
    if (el.classList.contains('main')) return onEnter(el);
    return;
  }
  if (it === 'deleteContentBackward' && el.classList.contains('main') && atStart(el)) { e.preventDefault(); return onBackspaceStart(el); }
  const now = Date.now();                          // agrupa a escrita em passos de "anular"
  if (now - D.typeSnapT > 1200) { pushHist(snap(page())); updateUndo(); }
  D.typeSnapT = now;
});
docView.addEventListener('input', e => {
  const el = ceOf(e); if (!el) return;
  syncCE(el);
  if (el.classList.contains('main')) {
    const b = blkOf(el.closest('.blk').dataset.id);
    if (b) {
      if (D.slash && D.slash.el === el) updateSlash();
      else if (e.data === '/') maybeOpenSlash(el, b);
      else if (e.data === ' ' || e.data === ' ') mdShortcut(el, b);
      if (b.type === 'p' && el.textContent === '---') {
        docPush(); b.type = 'divider'; b.html = '';
        const nb = { id: uid(), type: 'p', html: '' }; page().blocks.splice(bIndex(b.id) + 1, 0, nb);
        renderDoc({ id: nb.id, pos: 'start' }); markDirty(); return;
      }
    }
  }
  ensureVisible();
});
docView.addEventListener('keydown', e => {
  const el = ceOf(e); if (!el || e.isComposing) return;
  if (D.slash && D.slash.el === el) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); return moveSlash(e.key === 'ArrowDown' ? 1 : -1); }
    if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); return chooseSlash(); }
    if (e.key === 'Escape') { e.preventDefault(); return closeSlash(); }
  }
  if (el.id === 'docTitle') {
    if (e.key === 'Enter') { e.preventDefault(); titleEnter(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); focusNextText(-1); }
    return;
  }
  if (el.classList.contains('cell')) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); cellEnter(el); } return; }
  if (el.classList.contains('cap')) { if (e.key === 'Enter') e.preventDefault(); return; }
  if (!el.classList.contains('main')) return;
  const id = el.closest('.blk').dataset.id;
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onEnter(el); }
  else if (e.key === 'Backspace' && atStart(el)) { e.preventDefault(); onBackspaceStart(el); }
  else if (e.key === 'ArrowUp' && onFirstLine(el)) { e.preventDefault(); focusPrevText(bIndex(id)); }
  else if (e.key === 'ArrowDown' && onLastLine(el)) { e.preventDefault(); focusNextText(bIndex(id)); }
  else if (e.key === 'Tab') e.preventDefault();
});
docView.addEventListener('paste', e => {
  const el = ceOf(e); if (!el) return;
  e.preventDefault();
  const txt = ((e.clipboardData && e.clipboardData.getData('text/plain')) || '').replace(/\r/g, '');
  if (!txt) return;
  const lines = txt.split('\n');
  if (lines.length === 1 || !el.classList.contains('main')) { document.execCommand('insertText', false, lines.join(' ')); return; }
  const b = blkOf(el.closest('.blk').dataset.id), p = page(); if (!b) return;
  docPush(); D.typeSnapT = Date.now();
  document.execCommand('insertText', false, lines[0]);
  let tail = '';
  const s = getSelection();
  if (s.rangeCount) {
    const r = s.getRangeAt(0), t = document.createRange(); t.selectNodeContents(el); t.setStart(r.endContainer, r.endOffset);
    const tmp = document.createElement('div'); tmp.appendChild(t.extractContents()); tail = tmp.textContent ? tmp.innerHTML : '';
  }
  b.html = el.textContent ? el.innerHTML : '';
  let i = bIndex(b.id), last = null;
  const rest = lines.slice(1);
  rest.forEach((ln, k) => { last = { id: uid(), type: 'p', html: esc(ln) + (k === rest.length - 1 ? tail : '') }; p.blocks.splice(++i, 0, last); });
  renderDoc({ id: last.id, pos: rest[rest.length - 1].length }); markDirty();
});
docView.addEventListener('pointerdown', e => {
  if (D.slash && !e.target.closest('#slash') && !e.target.closest('.h-add') && !(D.slash.el && e.target.closest('.ce') === D.slash.el)) closeSlash();
});
docView.addEventListener('focusout', () => setTimeout(() => {
  if (D.slash && D.slash.mode === 'slash' && document.activeElement !== D.slash.el) closeSlash();
}, 200));
docView.addEventListener('click', e => {
  const t = e.target;
  if (t.closest('#slash')) return;
  if (t.closest('#docIcon')) return pickIcon();
  if (t.id === 'docEnd') return focusEndOfDoc();
  const host = t.closest('.blk'), b = host && blkOf(host.dataset.id); if (!b) return;
  if (t.closest('.h-add')) return openSlash({ el: null, id: b.id, start: 0, mode: 'plus' });
  if (t.closest('.h-mnu')) return blockMenu(b);
  if (t.closest('.chkb')) {
    docPush(); b.checked = !b.checked; host.classList.toggle('done', b.checked);
    const c = t.closest('.chkb'); c.classList.toggle('on', b.checked); c.textContent = b.checked ? '✓' : ''; markDirty(); return;
  }
  if (t.closest('.emo')) { docPush(); const k = CALLOUT_EMO.indexOf(b.emoji || '💡'); b.emoji = CALLOUT_EMO[(k + 1) % CALLOUT_EMO.length]; t.closest('.emo').textContent = b.emoji; markDirty(); return; }
  const go = t.closest('.plink'); if (go && go.dataset.go) { const j = S.pages.findIndex(q => q.id === go.dataset.go); if (j >= 0) goPage(j); return; }
  const tb = t.closest('.tbtns button'); if (tb) return tableAct(b, tb.dataset.a);
});

/* ---- barra de formatação ---- */
function hideFmt() { fmtBar.classList.add('hidden'); }
document.addEventListener('selectionchange', () => {
  if (!isDoc() || $('#editor').classList.contains('hidden')) return hideFmt();
  const s = getSelection();
  if (!s.rangeCount || s.isCollapsed) return hideFmt();
  const r = s.getRangeAt(0), n = r.commonAncestorContainer, host = n.nodeType === 1 ? n : n.parentNode;
  const ce = host && host.closest && host.closest('.ce');
  if (!ce || !docView.contains(ce)) return hideFmt();
  const rc = r.getBoundingClientRect();
  fmtBar.classList.remove('hidden');
  const w = fmtBar.offsetWidth, vv = window.visualViewport, bottom = vv ? vv.height + vv.offsetTop : innerHeight;
  fmtBar.style.left = clamp(rc.left + rc.width / 2 - w / 2, 8, innerWidth - w - 8) + 'px';
  fmtBar.style.top = Math.min(rc.bottom + 14, bottom - 56) + 'px';
});
fmtBar.addEventListener('pointerdown', e => e.preventDefault());
fmtBar.addEventListener('mousedown', e => e.preventDefault());
fmtBar.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
  const f = b.dataset.f, colour = { hl: ['hiliteColor', '#ffe066'], red: ['foreColor', '#d0312d'], blue: ['foreColor', '#1f5fbf'] }[f];
  document.execCommand('styleWithCSS', false, !!colour);
  if (colour) document.execCommand(colour[0], false, colour[1]); else document.execCommand(f);
  document.execCommand('styleWithCSS', false, false);
}));

/* ---- blocos de desenho à mão ---- */
function paintDraw(c, b, live) {
  const x = c.getContext('2d'), k = c.width / 1000;
  x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, c.width, c.height);
  x.setTransform(k, 0, 0, k, 0, 0);
  drawBackground(x, b.bg || 'liso', 1000, b.h, true);
  for (const s of b.strokes) drawStroke(x, s);
  if (live) drawStroke(x, live);
  return x;
}
function drawCanvas(b, k) { const c = document.createElement('canvas'); c.width = Math.round(1000 * k); c.height = Math.round(b.h * k); paintDraw(c, b); return c; }
function sizeDraw(cv, b) {
  const cssW = cv.parentNode.clientWidth || 700, cssH = b.h * cssW / 1000;
  let dpr = window.devicePixelRatio || 1;
  if (cssW * cssH * dpr * dpr > 8e6) dpr = Math.sqrt(8e6 / (cssW * cssH));
  cv.width = Math.round(cssW * dpr); cv.height = Math.round(cssH * dpr); cv.style.height = cssH + 'px';
  paintDraw(cv, b);
}
function dPt(e, cv) { const r = cv.getBoundingClientRect(), k = 1000 / r.width; return [(e.clientX - r.left) * k, (e.clientY - r.top) * k]; }
function dCtx(cv) { const x = cv.getContext('2d'), k = cv.width / 1000; x.setTransform(k, 0, 0, k, 0, 0); return x; }
function setupDraw(wrap) {
  const id = wrap.closest('.blk').dataset.id, cv = wrap.querySelector('canvas'), rz = wrap.querySelector('.rsz');
  sizeDraw(cv, blkOf(id));
  cv.addEventListener('pointerdown', e => drawDown(e, cv, id));
  cv.addEventListener('pointermove', e => drawMove(e, cv));
  cv.addEventListener('pointerup', e => drawUp(e, cv));
  cv.addEventListener('pointercancel', e => { D.touches.delete(e.pointerId); if (D.act && D.act.id === e.pointerId) drawAbort(); });
  cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('touchstart', e => e.preventDefault(), { passive: false });
  rz.addEventListener('touchstart', e => e.preventDefault(), { passive: false });
  rz.addEventListener('pointerdown', e => {
    e.preventDefault(); try { rz.setPointerCapture(e.pointerId); } catch (_) {}
    const b = blkOf(id); if (!b) return;
    const y0 = e.clientY, h0 = b.h, k = 1000 / cv.getBoundingClientRect().width, before = snap(page());
    const mv = ev => { b.h = Math.round(clamp(h0 + (ev.clientY - y0) * k, 150, 3000)); sizeDraw(cv, b); };
    const up = () => {
      rz.removeEventListener('pointermove', mv); rz.removeEventListener('pointerup', up); rz.removeEventListener('pointercancel', up);
      if (b.h !== h0) { pushHist(before); markDirty(); updateUndo(); }
    };
    rz.addEventListener('pointermove', mv); rz.addEventListener('pointerup', up); rz.addEventListener('pointercancel', up);
  });
}
function dAdd(a, x, y, raw, first) {
  const p = a.s.pts, pr = first ? raw : a.lastP * 0.55 + raw * 0.45; a.lastP = pr;
  const q = [r1(x), r1(y), Math.round(pr * 100) / 100];
  if (p.length) { const l = p[p.length - 1]; if (Math.hypot(q[0] - l[0], q[1] - l[1]) < 0.7) return; }
  p.push(q);
  if (a.s.tool === 'hl') return;
  const c = dCtx(a.cv); c.save(); c.lineCap = 'round'; c.strokeStyle = a.s.color; c.fillStyle = a.s.color;
  if (p.length === 1) { c.beginPath(); c.arc(q[0], q[1], wAt(a.s, q[2]) / 2, 0, 7); c.fill(); } else seg(c, a.s, p, p.length - 1);
  c.restore();
}
function eraseAt(a, x, y) {
  a.cx = x; a.cy = y;
  const keep = a.b.strokes.filter(s => !strokeHit(s, x, y, a.r));
  if (keep.length !== a.b.strokes.length) { a.b.strokes = keep; a.changed = true; }
}
function eraserCursor(a) {
  paintDraw(a.cv, a.b);
  const c = dCtx(a.cv); c.save(); c.strokeStyle = 'rgba(80,90,110,.7)'; c.lineWidth = 1.5;
  c.beginPath(); c.arc(a.cx, a.cy, a.r, 0, 7); c.stroke(); c.restore();
}
function drawDown(e, cv, id) {
  e.preventDefault();
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  const ae = document.activeElement; if (ae && ae.isContentEditable) ae.blur();
  try { cv.setPointerCapture(e.pointerId); } catch (_) {}
  if (e.pointerType === 'pen' && !S.penSeen) {
    S.penSeen = true; S.penOnly = true; saveSettings(); updatePenBtn();
    toast('Apple Pencil detetado: o lápis escreve e o dedo desloca a página.', 4000);
  }
  if (e.pointerType === 'touch') {
    D.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (D.act && D.act.pointerType === 'touch') { drawAbort(); return; }
    if (S.penOnly || D.touches.size > 1) return;
  }
  if (D.act) return;
  const b = blkOf(id); if (!b) return;
  const tool = S.tool === 'lasso' ? 'pen' : S.tool, [x, y] = dPt(e, cv);
  const a = D.act = { id: e.pointerId, pointerType: e.pointerType, cv, b, tool, before: snap(page()), orig: b.strokes };
  if (tool === 'eraser') { a.r = WIDTHS.eraser[S.w.eraser]; eraseAt(a, x, y); eraserCursor(a); }
  else {
    a.s = { id: uid(), tool, color: tool === 'pen' ? S.penColor : S.hlColor, w: WIDTHS[tool][S.w[tool]], pts: [] };
    a.lastP = pressureOf(e); dAdd(a, x, y, a.lastP, true);
    if (tool === 'hl') paintDraw(cv, b, a.s);
  }
}
function drawMove(e, cv) {
  const a = D.act;
  if (a && a.id === e.pointerId) {
    e.preventDefault();
    const co = e.getCoalescedEvents ? e.getCoalescedEvents() : null, list = co && co.length ? co : [e];
    for (const ev of list) { const [x, y] = dPt(ev, cv); if (a.s) dAdd(a, x, y, pressureOf(ev)); else eraseAt(a, x, y); }
    if (a.s && a.s.tool === 'hl') paintDraw(cv, a.b, a.s);
    if (!a.s) eraserCursor(a);
    return;
  }
  const t = D.touches.get(e.pointerId);
  if (e.pointerType === 'touch' && t) { e.preventDefault(); docView.scrollTop -= (e.clientY - t.y) / D.touches.size; t.x = e.clientX; t.y = e.clientY; }
}
function drawUp(e, cv) {
  if (e.pointerType === 'touch') D.touches.delete(e.pointerId);
  const a = D.act; if (!a || a.id !== e.pointerId) return;
  D.act = null;
  if (a.s) { if (a.s.pts.length) { pushHist(a.before); a.b.strokes = a.b.strokes.concat([a.s]); markDirty(); } }
  else if (a.changed) { pushHist(a.before); markDirty(); }
  paintDraw(cv, a.b); D.typeSnapT = 0; updateUndo();
}
function drawAbort() {
  const a = D.act; D.act = null; if (!a) return;
  a.b.strokes = a.orig; paintDraw(a.cv, a.b);
}
new ResizeObserver(() => {
  if (!isDoc()) return;
  const w = docEl.clientWidth; if (!w || w === D.w) return; D.w = w;
  docEl.querySelectorAll('.blk.t-draw').forEach(el => { const b = blkOf(el.dataset.id); if (b) sizeDraw(el.querySelector('canvas'), b); });
}).observe(docView);

/* ---- impressão / PDF de uma página de blocos ---- */
function docPrintNode(p) {
  const d = document.createElement('div'); d.className = 'pdoc';
  let h = `<div class="pt">${esc(p.icon || '')} ${esc(p.title || 'Sem título')}</div>`, n = 0;
  for (const b of p.blocks || []) {
    n = b.type === 'ol' ? n + 1 : 0;
    const t = clean(b.html || '');
    switch (b.type) {
      case 'h1': h += `<h1>${t}</h1>`; break;
      case 'h2': h += `<h2>${t}</h2>`; break;
      case 'h3': h += `<h3>${t}</h3>`; break;
      case 'ul': h += `<div>•&nbsp; ${t}</div>`; break;
      case 'ol': h += `<div>${n}.&nbsp; ${t}</div>`; break;
      case 'todo': h += `<div>${b.checked ? '☑' : '☐'}&nbsp; ${b.checked ? `<s>${t}</s>` : t}</div>`; break;
      case 'quote': h += `<blockquote>${t}</blockquote>`; break;
      case 'callout': h += `<div class="cl">${esc(b.emoji || '💡')}&nbsp; ${t}</div>`; break;
      case 'divider': h += '<hr>'; break;
      case 'draw': h += `<img src="${drawCanvas(b, 1.4).toDataURL('image/png')}" style="border:1px solid #ccc">`; break;
      case 'img': h += `<img src="${esc(b.src)}">${b.caption ? `<div style="color:#555;font-size:10pt">${clean(b.caption)}</div>` : ''}`; break;
      case 'table': h += '<table>' + b.rows.map(r => '<tr>' + r.map(c => `<td>${clean(c)}</td>`).join('') + '</tr>').join('') + '</table>'; break;
      case 'link': { const q = S.pages.find(x => x.id === b.target); h += `<p>↗ ${esc(q ? pageName(q) : 'Página apagada')}</p>`; break; }
      default: h += `<p>${t || '&nbsp;'}</p>`;
    }
  }
  d.innerHTML = h; return d;
}

/* ---- painel lateral com a árvore de páginas ---- */
function renderTree() {
  const t = $('#tree'); if (!t || !S.nb) return;
  t.innerHTML = S.pages.map((p, i) => `<button class="ti${i === S.idx ? ' on' : ''}" data-i="${i}" style="padding-left:${8 + depthOf(p) * 20}px">
    <span>${esc(p.kind === 'doc' ? (p.icon || '📄') : '📓')}</span><span class="n">${esc(pageName(p))}</span></button>`).join('');
  t.querySelectorAll('.ti').forEach(b => b.onclick = () => { closeSide(); goPage(+b.dataset.i); });
}
function toggleSide() {
  const open = $('#side').classList.contains('hidden');
  $('#side').classList.toggle('hidden', !open); $('#sideOv').classList.toggle('hidden', !open);
  if (open) renderTree();
}
function closeSide() { $('#side').classList.add('hidden'); $('#sideOv').classList.add('hidden'); }
