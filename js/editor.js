'use strict';
/* Caderno Digital — editor de cadernos, exportação, biblioteca e cópia de segurança
   Powered by Claude IA & Ideias&Soltas — concepção de produtos multimédia */

/* ---------- Editor: abrir, páginas, ferramentas ---------- */
async function openNotebook(id) {
  const nb = await DB.get('notebooks', id); if (!nb) return;
  const pages = [];
  for (const pid of nb.pages || []) { const p = await DB.get('pages', pid); if (p) pages.push(p); }
  if (!pages.length) { const p = newPage(nb.id, nb.bg); pages.push(p); await DB.put('pages', p); }
  pages.forEach(p => { if (!p.kind) p.kind = 'ink'; if (p.parent === undefined) p.parent = null; });
  nb.pages = pages.map(p => p.id);
  Object.assign(S, { nb, pages, idx: clamp(nb.lastPage || 0, 0, pages.length - 1), sel: null, act: null });
  S.hist.clear(); S.touches.clear();
  $('#library').classList.add('hidden'); $('#editor').classList.remove('hidden'); document.body.classList.add('editing');
  $('#nbTitle').textContent = nb.title;
  updatePenBtn();
  showView(); updatePage();
}
function showView() {                     // mostra a página atual: manuscrita ou de blocos
  const doc = isDoc();
  if (S.act) cancelAct();
  if (D.act) drawAbort();
  closeSlash(); hideFmt();
  $('#stage').classList.toggle('hidden', doc);
  $('#docView').classList.toggle('hidden', !doc);
  document.querySelector('[data-tool=lasso]').classList.toggle('hidden', doc);
  ['#btnBg', '#btnZoomOut', '#btnFit', '#btnZoomIn'].forEach(s => $(s).classList.toggle('hidden', doc));
  if (doc && S.tool === 'lasso') S.tool = 'pen';
  renderTools();
  if (doc) { renderDoc(); docView.scrollTop = 0; }
  else { clearSel(); layout(); stage.scrollTop = 0; }
  renderTree();
}
async function closeNotebook() {
  if (S.act) cancelAct();
  if (D.act) drawAbort();
  closeSlash(); hideFmt(); closeSide();
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  await flush();
  S.nb = null; S.pages = [];
  const dc = driveCfg(); if (dc && drivePending(dc) && Date.now() - (dc.lastTry || 0) > 60000) { dc.lastTry = Date.now(); saveDriveCfg(dc); driveBackup(false); }
  $('#editor').classList.add('hidden'); $('#library').classList.remove('hidden'); document.body.classList.remove('editing');
  renderLibrary();
}
function updatePage() {
  $('#pgLabel').textContent = `${S.idx + 1} / ${S.pages.length}`;
  $('#btnPrev').disabled = S.idx === 0;
  $('#btnNext').disabled = S.idx === S.pages.length - 1;
  updateUndo();
}
function goPage(i) {
  if (i < 0 || i >= S.pages.length) return;
  if (document.activeElement && document.activeElement.isContentEditable) document.activeElement.blur();
  S.idx = i; showView(); updatePage(); markDirty(null);
  const nx = S.pages[i + 1]; if (nx && nx.pdf) assetLoad(nx.pdf.asset);
}
function addPage(kind) {                  // nova página do mesmo tipo da atual, logo a seguir (mesmo nível)
  const cur = page();
  if (kind !== 'doc' && kind !== 'ink') kind = cur ? cur.kind : 'ink';
  const p = kind === 'doc' ? newDoc(S.nb.id) : newPage(S.nb.id, cur && cur.kind === 'ink' && cur.bg !== 'pdf' ? cur.bg : (S.nb.bg || 'pautado'));
  p.parent = cur ? cur.parent || null : null;
  const at = S.pages.length ? subtreeEnd(S.idx) : 0;
  S.pages.splice(at, 0, p);
  markDirty(p.id); goPage(at); toast('Página adicionada');
}
async function deletePage() {
  const cur = page(), n = subtreeEnd(S.idx) - S.idx;
  if (S.pages.length === 1) {
    if (!await confirmBox('Limpar página', 'É a única página do caderno. Queres apagar todo o conteúdo dela?', 'Limpar')) return;
    if (cur.kind === 'doc') { pushHist(snap(cur)); cur.blocks = [{ id: uid(), type: 'p', html: '' }]; afterDocEdit(); }
    else if (cur.bg === 'pdf') { pushHist(cur.strokes); cur.strokes = []; afterEdit(); toast('A escrita foi apagada; o PDF fica.'); }
    else { pushHist(cur.strokes); cur.strokes = []; afterEdit(); }
    return;
  }
  const extra = n > 1 ? ` e as suas ${n - 1} subpágina(s)` : '';
  if (!await confirmBox('Apagar página', `Apagar «${pageName(cur)}»${extra}? Esta ação não pode ser anulada.`)) return;
  const removed = S.pages.splice(S.idx, n);
  for (const p of removed) { S.hist.delete(p.id); S.dirtyPages.delete(p.id); try { await DB.del('pages', p.id); } catch (_) {} }
  await delAssets(removed);
  if (!S.pages.length) { const p = cur.kind === 'doc' ? newDoc(S.nb.id) : newPage(S.nb.id, S.nb.bg); S.pages.push(p); markDirty(p.id); }
  S.idx = Math.min(S.idx, S.pages.length - 1);
  showView(); updatePage(); markDirty(null); await flush();
}
function renderTools() {
  document.querySelectorAll('.tool').forEach(b => b.classList.toggle('on', b.dataset.tool === S.tool));
  const t = S.tool, sw = $('#swatches'), wd = $('#widths');
  sw.innerHTML = ''; wd.innerHTML = '';
  if (t === 'pen' || t === 'hl') {
    const cols = t === 'pen' ? PEN_COLORS : HL_COLORS, cur = t === 'pen' ? S.penColor : S.hlColor;
    cols.forEach(c => {
      const b = document.createElement('button');
      b.className = 'sw' + (c === cur ? ' on' : ''); b.style.background = c;
      b.onclick = () => { if (t === 'pen') S.penColor = c; else S.hlColor = c; saveSettings(); renderTools(); };
      sw.appendChild(b);
    });
  }
  if (t !== 'lasso') {
    const col = t === 'pen' ? S.penColor : t === 'hl' ? S.hlColor : 'var(--ink)';
    WIDTHS[t].forEach((w, i) => {
      const b = document.createElement('button'), d = [6, 11, 17][i];
      b.className = 'wb' + (S.w[t] === i ? ' on' : ''); b.style.color = col;
      b.title = ['Fino', 'Médio', 'Grosso'][i];
      b.innerHTML = `<i style="width:${d}px;height:${d}px;${t === 'hl' ? 'border-radius:3px;' : ''}${t === 'eraser' ? 'background:none;border:2px solid currentColor;' : ''}"></i>`;
      b.onclick = () => { S.w[t] = i; saveSettings(); renderTools(); };
      wd.appendChild(b);
    });
  }
  sw.classList.toggle('hidden', !sw.children.length);
  $('#sepW').classList.toggle('hidden', !sw.children.length || !wd.children.length);
}
function updatePenBtn() { $('#btnPenOnly').classList.toggle('on', S.penOnly); }

async function chooseBg() {
  const cur = page().bg;
  if (cur === 'pdf') { toast('Esta página tem um PDF como fundo: o papel não se muda.'); return; }
  const r = await modal(`<h2>Papel</h2><div class="opts">${BGS.map(([k, l]) =>
      `<button class="opt${k === cur ? ' on' : ''}" data-bg="${k}"><canvas width="168" height="238"></canvas>${l}</button>`).join('')}</div>
    <label class="chk"><input type="checkbox" id="allPg"> Aplicar a todas as páginas deste caderno</label>
    <div class="acts"><button class="btn" data-close>Cancelar</button></div>`,
    (m, close) => m.querySelectorAll('.opt').forEach(b => {
      renderBgThumb(b.querySelector('canvas'), b.dataset.bg);
      b.onclick = () => close({ bg: b.dataset.bg, all: m.querySelector('#allPg').checked });
    }));
  if (!r) return;
  (r.all ? S.pages.filter(p => p.bg !== 'pdf') : [page()]).forEach(p => { p.bg = r.bg; markDirty(p.id); });
  if (r.all) S.nb.bg = r.bg;
  redrawBase();
}
function renderBgThumb(c, bg) { const x = c.getContext('2d'); x.setTransform(c.width / PAGE_W, 0, 0, c.height / PAGE_H, 0, 0); drawBackground(x, bg); }

async function showPages() {
  await modal(`<h2>Páginas (${S.pages.length})</h2><div class="thumbs">${S.pages.map((p, i) =>
      `<button class="thumb${i === S.idx ? ' on' : ''}" data-i="${i}"><canvas width="240" height="339"></canvas>${i + 1}</button>`).join('')}</div>
    <div class="acts"><button class="btn" data-close>Fechar</button></div>`,
    async (m, close) => {
      const btns = [...m.querySelectorAll('.thumb')];
      btns.forEach(b => b.onclick = () => { close(); goPage(+b.dataset.i); });
      for (let k = 0; k < btns.length; k++) {
        if (!btns[k].isConnected) return;
        if (S.pages[k].pdf) await assetLoad(S.pages[k].pdf.asset);
        renderPageTo(btns[k].querySelector('canvas'), S.pages[k]);
        if (k % 4 === 3) await new Promise(requestAnimationFrame);
      }
    }, 'wide');
}

/* ---------- Exportar ---------- */
function pageCanvas(p, k) { const c = document.createElement('canvas'); c.width = PAGE_W * k; c.height = PAGE_H * k; renderPageTo(c, p); return c; }
async function shareBlob(blob, name) {
  const f = new File([blob], name, { type: blob.type });
  if (navigator.canShare && navigator.canShare({ files: [f] })) {
    try { await navigator.share({ files: [f] }); return; }
    catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
}
async function exportPng() {
  if (page().pdf) await assetLoad(page().pdf.asset);
  pageCanvas(page(), 2).toBlob(b => shareBlob(b, `${safeName(S.nb.title)}-pag${S.idx + 1}.png`), 'image/png');
}
async function exportPdf(list) {
  if (!Array.isArray(list)) list = S.pages;
  await flush();
  toast('A preparar o PDF…');
  const box = $('#print'); box.innerHTML = '';
  for (const p of list) {
    if (p.kind === 'doc') box.appendChild(docPrintNode(p));
    else {
      if (p.pdf) await assetLoad(p.pdf.asset);
      const img = new Image(); img.src = pageCanvas(p, 1.6).toDataURL('image/jpeg', 0.92); box.appendChild(img);
    }
    await new Promise(r => setTimeout(r));
  }
  await Promise.all([...box.querySelectorAll('img')].map(i => i.decode ? i.decode().catch(() => {}) : null));
  toast('No painel de impressão, usa «Partilhar» para guardar como PDF.', 6000);
  setTimeout(() => window.print(), 150);
}
window.addEventListener('afterprint', () => { $('#print').innerHTML = ''; });

async function moreMenu() {
  const doc = isDoc(), items = [];
  items.push(doc ? { label: 'Exportar esta página (PDF)', value: 'pdf1' } : { label: 'Exportar esta página (imagem)', value: 'png' });
  items.push({ label: 'Exportar o caderno (PDF)', value: 'pdf' });
  if (!doc) items.push({ label: 'Mudar o nome desta página', value: 'renp' });
  items.push({ label: '📄 Inserir um PDF a seguir a esta página', value: 'ipdf' });
  items.push({ label: 'Mudar o nome do caderno', value: 'ren' });
  items.push({ label: 'Apagar esta página', value: 'del', danger: true });
  const v = await actionSheet('Mais opções', items);
  if (v === 'png') exportPng();
  else if (v === 'pdf') exportPdf();
  else if (v === 'pdf1') exportPdf([page()]);
  else if (v === 'renp') { const t = await askText('Nome da página', page().title || ''); if (t) { page().title = t; markDirty(); renderTree(); } }
  else if (v === 'ren') { const t = await askText('Nome do caderno', S.nb.title); if (t) { S.nb.title = t; $('#nbTitle').textContent = t; markDirty(null); } }
  else if (v === 'del') deletePage();
  else if (v === 'ipdf') { pdfHere = true; $('#filePdf').click(); }
}

/* ---------- Biblioteca ---------- */
async function renderLibrary() {
  const list = (await DB.all('notebooks')).sort((a, b) => b.updated - a.updated);
  const g = $('#grid');
  if (!list.length) {
    g.innerHTML = `<div class="empty"><p style="font-size:17px;margin:0 0 6px">Ainda não tens cadernos.</p><p style="margin:0">Toca em <b>+ Novo caderno</b> para começar.</p></div>`;
  } else {
    g.innerHTML = list.map(nb => `
      <div class="card" data-id="${nb.id}">
        <button class="cover" style="background:${esc(nb.color)}"><span class="ttl">${esc(nb.title)}</span><span class="lbl">${(nb.pages || []).length} pág.</span></button>
        <div class="meta"><span>${fmtDate(nb.updated)}</span><button class="more" title="Opções">⋯</button></div>
      </div>`).join('');
    g.querySelectorAll('.card').forEach(c => {
      const nb = list.find(n => n.id === c.dataset.id);
      c.querySelector('.cover').onclick = () => openNotebook(nb.id);
      c.querySelector('.more').onclick = () => nbMenu(nb);
    });
  }
  storageInfo();
}
async function nbMenu(nb) {
  const v = await actionSheet(nb.title, [
    { label: 'Abrir', value: 'open' },
    { label: 'Mudar o nome', value: 'ren' },
    { label: 'Mudar a cor da capa', value: 'col' },
    { label: 'Apagar caderno', value: 'del', danger: true }
  ]);
  if (v === 'open') return openNotebook(nb.id);
  if (v === 'ren') { const t = await askText('Nome do caderno', nb.title); if (t) { nb.title = t; await DB.put('notebooks', nb); } }
  if (v === 'col') { const c = await pickColor('Cor da capa', nb.color); if (c) { nb.color = c; await DB.put('notebooks', nb); } }
  if (v === 'del') {
    if (!await confirmBox('Apagar caderno', `Apagar «${nb.title}» e todas as suas páginas? Esta ação não pode ser anulada.`)) return;
    for (const pid of nb.pages || []) { const p = await DB.get('pages', pid); await DB.del('pages', pid); await delAssets([p]); }
    await DB.del('notebooks', nb.id);
    toast('Caderno apagado');
  }
  if (v) noteChange();
  renderLibrary();
}
async function newNotebook() {
  let color = COVERS[Math.floor(Math.random() * COVERS.length)], bg = 'pautado', first = 'ink';
  const r = await modal(`<h2>Novo caderno</h2>
    <label class="l">Nome</label><input type="text" id="nbName" placeholder="Ex.: Geografia 9.º C" maxlength="60">
    <label class="l">Capa</label><div class="colors">${COVERS.map(c => `<button data-c="${c}" style="background:${c}"></button>`).join('')}</div>
    <label class="l">Primeira página</label><div class="opts">
      <button class="opt kind" data-k="ink" style="width:130px;font-size:14px;padding:10px"><span style="font-size:26px">📓</span><br>Manuscrita</button>
      <button class="opt kind" data-k="doc" style="width:130px;font-size:14px;padding:10px"><span style="font-size:26px">📄</span><br>Blocos (texto)</button></div>
    <label class="l">Papel das páginas manuscritas</label><div class="opts">${BGS.map(([k, l]) => `<button class="opt" data-bg="${k}"><canvas width="168" height="238"></canvas>${l}</button>`).join('')}</div>
    <div class="acts"><button class="btn" data-close>Cancelar</button><button class="btn primary" id="mOk">Criar</button></div>`,
    (m, close) => {
      const upd = () => {
        m.querySelectorAll('.colors button').forEach(b => b.classList.toggle('on', b.dataset.c === color));
        m.querySelectorAll('.opt[data-bg]').forEach(b => b.classList.toggle('on', b.dataset.bg === bg));
        m.querySelectorAll('.opt.kind').forEach(b => b.classList.toggle('on', b.dataset.k === first));
      };
      m.querySelectorAll('.opt.kind').forEach(b => b.onclick = () => { first = b.dataset.k; upd(); });
      m.querySelectorAll('.colors button').forEach(b => b.onclick = () => { color = b.dataset.c; upd(); });
      m.querySelectorAll('.opt[data-bg]').forEach(b => { renderBgThumb(b.querySelector('canvas'), b.dataset.bg); b.onclick = () => { bg = b.dataset.bg; upd(); }; });
      upd();
      const i = m.querySelector('#nbName'); setTimeout(() => i.focus(), 60);
      m.querySelector('#mOk').onclick = () => close({ title: i.value.trim() || 'Caderno sem nome', color, bg, first });
    });
  if (!r) return;
  const nb = { id: uid(), title: r.title, color: r.color, bg: r.bg, created: Date.now(), updated: Date.now(), pages: [], lastPage: 0 };
  const p = r.first === 'doc' ? newDoc(nb.id) : newPage(nb.id, nb.bg); nb.pages = [p.id];
  await DB.put('pages', p); await DB.put('notebooks', nb);
  noteChange(); requestPersist();
  openNotebook(nb.id);
}

/* ---------- Cópia de segurança ---------- */
async function collectBackup() {
  const notebooks = await DB.all('notebooks'), pages = await DB.all('pages');
  return { app: 'caderno-digital', versao: 2, exportado: new Date().toISOString(), notebooks, pages };
}
async function backup() {
  await flush();
  const data = await collectBackup();
  if (!data.notebooks.length) { toast('Ainda não há cadernos para copiar.'); return; }
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  await shareBlob(blob, `cadernos-copia-${new Date().toISOString().slice(0, 10)}.json`);
}
async function restore(file) {
  let data;
  try { data = JSON.parse(await file.text()); } catch (e) { toast('Ficheiro inválido.'); return; }
  await restoreData(data);
}
async function restoreData(data, origem = '') {
  if (!data || data.app !== 'caderno-digital' || !Array.isArray(data.notebooks)) { toast('Este ficheiro não é uma cópia do Caderno Digital.'); return; }
  if (!await confirmBox('Restaurar cópia', `Restaurar ${data.notebooks.length} caderno(s)${origem}? Os cadernos que também existem na cópia são substituídos pela versão da cópia; os restantes ficam intactos.`, 'Restaurar', false)) return;
  for (const p of data.pages || []) await DB.put('pages', p);
  for (const n of data.notebooks) await DB.put('notebooks', n);
  noteChange(); toast('Cópia restaurada.'); renderLibrary();
}
