'use strict';
/* Caderno Digital — ligação ao Google Drive (ponte Apps Script) e armazenamento
   Powered by Claude IA & Ideias&Soltas — concepção de produtos multimédia */

/* ---------- Ligação ao Google Drive (ponte Apps Script) ---------- */
const DRIVE_KEY = 'cd-drive-v1';
const DRIVE_AUTO_MIN = 10;                 // cópia automática, no máximo de 10 em 10 minutos
let driveBusy = false;
function driveCfg() { try { return JSON.parse(localStorage.getItem(DRIVE_KEY) || 'null'); } catch (e) { return null; } }
function saveDriveCfg(c) { try { if (c) localStorage.setItem(DRIVE_KEY, JSON.stringify(c)); else localStorage.removeItem(DRIVE_KEY); } catch (e) {} }
function noteChange() { const c = driveCfg(); if (c) { c.changedAt = Date.now(); saveDriveCfg(c); } }
const drivePending = c => !!c && (c.changedAt || 0) > (c.backupAt || 0);
async function driveCall(payload, cfg = driveCfg()) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 60000);
  try {
    const r = await fetch(cfg.url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(Object.assign({ chave: cfg.chave }, payload)), signal: ctl.signal, redirect: 'follow' });
    let j; try { j = await r.json(); } catch (e) { throw new Error('a ponte não respondeu como esperado (confirma o URL e o acesso «Qualquer pessoa»)'); }
    if (!j.ok) throw new Error(j.erro || 'erro desconhecido');
    return j;
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('a ligação demorou demasiado');
    if (e instanceof TypeError) throw new Error('sem ligação à ponte (confirma a internet e o URL)');
    throw e;
  } finally { clearTimeout(t); }
}
async function driveBackup(manual) {
  const c = driveCfg();
  if (!c) { if (manual) driveSetup(); return; }
  if (driveBusy) { if (manual) toast('Já está a copiar…'); return; }
  if (!navigator.onLine) { if (manual) toast('Sem internet. A cópia faz-se sozinha quando houver rede.'); return; }
  driveBusy = true;
  try {
    await flush();
    const started = Date.now(), data = await collectBackup();
    if (!data.notebooks.length) { if (manual) toast('Ainda não há cadernos para copiar.'); return; }
    if (manual) toast('A copiar para o Drive…', 20000);
    const j = await driveCall({ acao: 'guardar', dados: JSON.stringify(data) });
    const c2 = driveCfg() || c; c2.backupAt = started; c2.lastOk = Date.now(); c2.lastErr = ''; saveDriveCfg(c2);
    if (manual) toast(`Cópia guardada no Drive (${j.ficheiro}).`, 4000);
  } catch (e) {
    const c2 = driveCfg(); if (c2) { c2.lastErr = e.message; saveDriveCfg(c2); }
    if (manual) toast('Não foi possível copiar para o Drive: ' + e.message, 6000);
  } finally { driveBusy = false; storageInfo(); }
}
function driveAuto() {
  const c = driveCfg();
  if (!c || !drivePending(c) || driveBusy || !navigator.onLine) return;
  if (Date.now() - (c.lastTry || 0) < DRIVE_AUTO_MIN * 60000) return;
  c.lastTry = Date.now(); saveDriveCfg(c);
  driveBackup(false);
}
async function driveRestore() {
  const c = driveCfg(); if (!c) return driveSetup();
  if (!navigator.onLine) return toast('Sem internet.');
  toast('A ir buscar a última cópia ao Drive…', 20000);
  try {
    const j = await driveCall({ acao: 'ultima' });
    toast('Cópia recebida.', 1500);
    await restoreData(JSON.parse(j.dados), ` a partir do Drive (${j.ficheiro})`);
  } catch (e) { toast('Não foi possível ir buscar a cópia: ' + e.message, 6000); }
}
async function driveSetup() {
  const c = driveCfg() || {};
  const r = await modal(`<h2>Ligação ao Google Drive</h2>
    <p>Cola aqui o URL da ponte (termina em <b>/exec</b>) e a chave secreta que apareceu no Apps Script. As instruções estão no ficheiro da ponte.</p>
    <label class="l">URL da ponte</label><input type="text" id="dUrl" value="${esc(c.url || '')}" placeholder="https://script.google.com/macros/s/…/exec" autocapitalize="off" autocorrect="off" spellcheck="false">
    <label class="l">Chave secreta</label><input type="text" id="dKey" value="${esc(c.chave || '')}" autocapitalize="off" autocorrect="off" spellcheck="false">
    <p id="dMsg" style="margin-top:12px;min-height:20px"></p>
    <div class="acts">${c.url ? '<button class="btn danger" id="dOff">Desligar</button>' : ''}<button class="btn" data-close>Cancelar</button><button class="btn primary" id="dOk">Testar e guardar</button></div>`,
    (m, close) => {
      const msg = m.querySelector('#dMsg');
      const off = m.querySelector('#dOff'); if (off) off.onclick = () => close('off');
      m.querySelector('#dOk').onclick = async () => {
        const url = m.querySelector('#dUrl').value.trim(), chave = m.querySelector('#dKey').value.trim();
        if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(url)) { msg.textContent = 'O URL deve ser do tipo https://script.google.com/macros/s/…/exec'; return; }
        if (chave.length < 16) { msg.textContent = 'A chave parece incompleta.'; return; }
        msg.textContent = 'A testar a ligação…';
        try { await driveCall({ acao: 'testar' }, { url, chave }); close({ url, chave }); }
        catch (e) { msg.textContent = '✖ ' + e.message; }
      };
    });
  if (r === 'off') { saveDriveCfg(null); toast('Ligação ao Drive desligada.'); storageInfo(); return; }
  if (!r) return;
  saveDriveCfg({ url: r.url, chave: r.chave, changedAt: Date.now(), backupAt: 0 });
  toast('Ligado ao Drive. A fazer a primeira cópia…');
  driveBackup(true);
}
async function driveMenu() {
  const c = driveCfg();
  if (!c) return driveSetup();
  const v = await actionSheet('Google Drive', [
    { label: '☁ Copiar agora para o Drive', value: 'now' },
    { label: '⤓ Restaurar a última cópia do Drive', value: 'rest' },
    { label: '⚙ Configurar a ligação', value: 'cfg' }
  ]);
  if (v === 'now') driveBackup(true);
  else if (v === 'rest') driveRestore();
  else if (v === 'cfg') driveSetup();
}

/* ---------- Armazenamento persistente e informação ---------- */
async function requestPersist() { try { if (navigator.storage && navigator.storage.persist) await navigator.storage.persist(); } catch (_) {} }
async function storageInfo() {
  const el = $('#storageInfo'); let t = '';
  try {
    if (navigator.storage && navigator.storage.estimate) { const e = await navigator.storage.estimate(); t = `Espaço ocupado: ${(e.usage / 1048576).toFixed(1)} MB`; }
    if (navigator.storage && navigator.storage.persisted && await navigator.storage.persisted()) t += ' · armazenamento protegido';
  } catch (_) {}
  if (DB.memory) t = '⚠ Modo temporário: este navegador não permite guardar os cadernos.';
  const c = driveCfg();
  if (c) {
    const when = c.lastOk ? new Date(c.lastOk).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'ainda nenhuma';
    t += `${t ? ' · ' : ''}☁ Drive: última cópia ${when}` + (drivePending(c) ? ' (há alterações por copiar)' : '') + (c.lastErr ? ' ⚠' : '');
  } else t += `${t ? ' · ' : ''}☁ Drive não ligado`;
  el.textContent = t;
}
