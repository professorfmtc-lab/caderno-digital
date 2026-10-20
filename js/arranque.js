'use strict';
/* Caderno Digital — ligações dos botões e arranque da app
   Powered by Claude IA & Ideias&Soltas — concepção de produtos multimédia */

/* ---------- Ligações dos botões ---------- */
$('#btnNew').onclick = newNotebook;
let pdfHere = false;
$('#btnPdf').onclick = () => { pdfHere = false; $('#filePdf').click(); };
$('#filePdf').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) importPdf(f, pdfHere && !!S.nb); };
$('#btnBackup').onclick = backup;
$('#btnDrive').onclick = driveMenu;
$('#btnRestore').onclick = () => $('#fileRestore').click();
$('#fileRestore').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) restore(f); };
$('#btnBack').onclick = closeNotebook;
document.querySelectorAll('.tool').forEach(b => b.onclick = () => { S.tool = b.dataset.tool; if (S.tool !== 'lasso') clearSel(); saveSettings(); renderTools(); });
$('#btnUndo').onclick = undo;
$('#btnRedo').onclick = redo;
$('#btnPrev').onclick = () => goPage(S.idx - 1);
$('#btnNext').onclick = () => goPage(S.idx + 1);
$('#btnAddPage').onclick = () => addPage();
$('#btnPages').onclick = toggleSide;
$('#sideOv').onclick = closeSide;
$('#btnThumbs').onclick = () => { closeSide(); showPages(); };
$('#btnNewDoc').onclick = () => { closeSide(); addPage('doc'); };
$('#btnNewInk').onclick = () => { closeSide(); addPage('ink'); };
$('#btnBg').onclick = chooseBg;
$('#btnMore').onclick = moreMenu;
$('#btnZoomIn').onclick = () => zoomTo(S.scale * 1.25);
$('#btnZoomOut').onclick = () => zoomTo(S.scale / 1.25);
$('#btnFit').onclick = () => { S.fit = S.fit === 'width' ? 'page' : 'width'; saveSettings(); layout(); };
$('#btnPenOnly').onclick = () => {
  S.penOnly = !S.penOnly; saveSettings(); updatePenBtn();
  toast(S.penOnly ? 'Só o lápis escreve. O dedo desloca a página.' : 'O dedo também escreve. Usa dois dedos para deslocar.');
};
document.addEventListener('keydown', e => {
  if (!S.nb || document.querySelector('.ov') || e.target.matches('input')) return;
  const k = (e.key || '').toLowerCase(), undoKey = (e.metaKey || e.ctrlKey) && k === 'z';
  if (undoKey) { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if (e.target.isContentEditable || isDoc()) return;
  if (k === 'arrowright' || k === 'pagedown') goPage(S.idx + 1);
  else if (k === 'arrowleft' || k === 'pageup') goPage(S.idx - 1);
  else if (k === 'p') { S.tool = 'pen'; renderTools(); }
  else if (k === 'm') { S.tool = 'hl'; renderTools(); }
  else if (k === 'e') { S.tool = 'eraser'; renderTools(); }
  else if (k === 'l') { S.tool = 'lasso'; renderTools(); }
});
let rzRaf = 0;
new ResizeObserver(() => {
  if (!S.nb || S.fit === 'custom') return;
  cancelAnimationFrame(rzRaf); rzRaf = requestAnimationFrame(layout);
}).observe(stage);

/* ---------- Arranque ---------- */
(async function init() {
  loadSettings();
  await DB.ready();
  const standalone = window.navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (ios && !standalone) $('#installHint').classList.remove('hidden');
  requestPersist();
  renderLibrary();
  setInterval(driveAuto, 60000);                       // cópia automática para o Drive
  window.addEventListener('online', () => setTimeout(driveAuto, 3000));
  setTimeout(driveAuto, 5000);
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
})();
