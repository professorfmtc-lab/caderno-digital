'use strict';
/* Caderno Digital — fase 3: abrir PDFs e usá-los como fundo das páginas manuscritas
   Powered by Claude IA & Ideias&Soltas — concepção de produtos multimédia */

/* ---------- Fase 3: PDFs como fundo das páginas manuscritas ----------
   Cada página do PDF é convertida numa imagem (JPEG) guardada no iPad, como
   registo «asset» no mesmo armazém das páginas. A escrita fica por cima, à parte:
   o PDF original nunca é alterado. As cópias de segurança levam os fundos. */
const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
const PDF_MAX = 60;                       // páginas por importação (memória do iPad)
const PDF_RES = 1500;                     // largura máxima da imagem de cada página, em píxeis
const IMG_KEEP = 8;                       // imagens de fundo mantidas em memória ao mesmo tempo
const IMG = new Map();                    // id do fundo -> { img, bad, wait }
function pdfRect(d) {                     // a página do PDF cabe inteira na folha, centrada
  const k = Math.min(PAGE_W / d.w, PAGE_H / d.h), w = d.w * k, h = d.h * k;
  return { x: (PAGE_W - w) / 2, y: (PAGE_H - h) / 2, w, h };
}
function assetLoad(id) {
  let e = IMG.get(id);
  if (e) { IMG.delete(id); IMG.set(id, e); return e.wait; }        // passa a ser o mais recente
  e = { img: null, bad: false };
  IMG.set(id, e);
  e.wait = DB.get('pages', id).then(a => new Promise(res => {
    if (!a || !a.data) { e.bad = true; return res(); }
    const im = new Image();
    im.onload = () => { e.img = im; res(); };
    im.onerror = () => { e.bad = true; res(); };
    im.src = a.data;
  })).catch(() => { e.bad = true; });
  if (IMG.size > IMG_KEEP) {                                        // liberta os mais antigos
    const cur = page() && page().pdf ? page().pdf.asset : null;
    for (const k of IMG.keys()) { if (IMG.size <= IMG_KEEP) break; if (k !== id && k !== cur) IMG.delete(k); }
  }
  return e.wait;
}
function drawPageBg(ctx, p) {
  if (p.bg !== 'pdf' || !p.pdf) return drawBackground(ctx, p.bg);
  ctx.save();
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, PAGE_W, PAGE_H);
  const r = pdfRect(p.pdf), id = p.pdf.asset, e = IMG.get(id);
  if (e && e.img) ctx.drawImage(e.img, r.x, r.y, r.w, r.h);
  else {
    ctx.fillStyle = '#f4f6fa'; ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.fillStyle = '#98a2b3'; ctx.font = '30px -apple-system, "Segoe UI", sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(e && e.bad ? 'Fundo do PDF em falta' : 'A carregar o PDF…', PAGE_W / 2, PAGE_H / 2);
    if (!e || !e.bad) (e ? e.wait : assetLoad(id)).then(() => {
      const pg = page(), f = IMG.get(id);
      if (f && f.img && S.nb && pg && pg.pdf && pg.pdf.asset === id && !isDoc()) redrawBase(S.act && S.act.mode === 'drag' && S.sel ? S.sel.ids : undefined);
    });
  }
  ctx.restore();
}
let pdfjsP = null;
function loadPdfJs() {                    // o leitor de PDF só é carregado quando é preciso
  if (pdfjsP) return pdfjsP;
  pdfjsP = (async () => {
    if (!window.pdfjsLib) await new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = PDFJS + 'pdf.min.js'; s.crossOrigin = 'anonymous';
      s.onload = res; s.onerror = () => rej(new Error('não foi possível carregar o leitor de PDF (na primeira vez é preciso internet)'));
      document.head.appendChild(s);
    });
    let code;
    try { const r = await fetch(PDFJS + 'pdf.worker.min.js', { mode: 'cors' }); if (!r.ok) throw 0; code = await r.text(); }
    catch (_) { throw new Error('não foi possível carregar o leitor de PDF (na primeira vez é preciso internet)'); }
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
    return window.pdfjsLib;
  })();
  pdfjsP.catch(() => { pdfjsP = null; });
  return pdfjsP;
}
async function pdfToPages(file, nbId, made) {   // devolve as páginas novas (ainda não gravadas)
  toast('A abrir o PDF…', 60000);
  const lib = await loadPdfJs();
  let doc;
  try { doc = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise; }
  catch (e) { throw new Error(e && e.name === 'PasswordException' ? 'o PDF está protegido por palavra-passe' : 'o ficheiro não parece ser um PDF válido'); }
  let n = doc.numPages;
  if (n > PDF_MAX) {
    if (!await confirmBox('PDF grande', `Este PDF tem ${n} páginas. Para não sobrecarregar o iPad, são importadas só as primeiras ${PDF_MAX}.`, 'Continuar', false)) { doc.destroy(); return null; }
    n = PDF_MAX;
  }
  const out = [], c = document.createElement('canvas'), nome = file.name.replace(/\.pdf$/i, '');
  try {
    for (let i = 1; i <= n; i++) {
      toast(`A importar a página ${i} de ${n}…`, 60000);
      const pg = await doc.getPage(i);
      const v1 = pg.getViewport({ scale: 1 });
      const k = Math.min(PDF_RES / v1.width, (PDF_RES * PAGE_H / PAGE_W) / v1.height);
      const vp = pg.getViewport({ scale: k });
      c.width = Math.round(vp.width); c.height = Math.round(vp.height);
      const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
      await pg.render({ canvasContext: x, viewport: vp }).promise;
      pg.cleanup();
      const a = { id: 'a' + uid(), kind: 'asset', nb: nbId, data: c.toDataURL('image/jpeg', 0.82), w: c.width, h: c.height };
      await DB.put('pages', a); made.push(a.id);
      const p = newPage(nbId, 'pdf');
      p.pdf = { asset: a.id, w: a.w, h: a.h, src: nome, n: i };
      out.push(p);
      await new Promise(r => setTimeout(r));
    }
  } finally { c.width = c.height = 0; doc.destroy(); }
  return out;
}
async function importPdf(file, here) {    // here: inserir no caderno aberto; senão, caderno novo
  const made = [];
  try {
    if (here) {
      await flush();
      const pages = await pdfToPages(file, S.nb.id, made); if (!pages) return;
      const cur = page(), at = subtreeEnd(S.idx);
      pages.forEach(p => { p.parent = cur ? cur.parent || null : null; });
      S.pages.splice(at, 0, ...pages);
      pages.forEach(p => markDirty(p.id));
      await flush(); goPage(at);
      toast(`${pages.length} página(s) do PDF inseridas. Já podes escrever por cima.`, 4000);
    } else {
      const nb = { id: uid(), title: file.name.replace(/\.pdf$/i, '').slice(0, 60) || 'PDF', color: COVERS[Math.floor(Math.random() * COVERS.length)],
                   bg: 'liso', created: Date.now(), updated: Date.now(), pages: [], lastPage: 0 };
      const pages = await pdfToPages(file, nb.id, made); if (!pages) return;
      for (const p of pages) await DB.put('pages', p);
      nb.pages = pages.map(p => p.id);
      await DB.put('notebooks', nb);
      noteChange(); requestPersist();
      toast(`PDF aberto (${pages.length} página(s)). Já podes escrever por cima.`, 4000);
      openNotebook(nb.id);
    }
  } catch (e) {
    for (const id of made) { try { await DB.del('pages', id); } catch (_) {} }
    toast('Não foi possível abrir o PDF: ' + (e && e.message || e), 6000);
  }
}
async function delAssets(pages) {         // apaga os fundos de PDF das páginas indicadas
  for (const p of pages) if (p && p.pdf && p.pdf.asset) { IMG.delete(p.pdf.asset); try { await DB.del('pages', p.pdf.asset); } catch (_) {} }
}
