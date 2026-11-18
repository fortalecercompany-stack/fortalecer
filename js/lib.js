// FORTALECER · utilidades compartidas
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const ic = (id, s = 20) => `<svg width="${s}" height="${s}" aria-hidden="true"><use href="#${id}"/></svg>`;

export const AREAS = ['Lectura Crítica', 'Matemáticas', 'Sociales y Ciudadanas', 'Ciencias Naturales', 'Inglés'];
export const SHORT = ['Lectura', 'Matemáticas', 'Sociales', 'Ciencias', 'Inglés'];
export const AICON = ['a-book', 'a-sigma', 'a-globe', 'a-flask', 'a-chat'];
export const col = i => `var(--a${i + 1})`;
export const soft = i => `var(--a${i + 1}s)`;
export const aico = (i, s = 40) => `<span class="aico" style="width:${s}px;height:${s}px;background:${soft(i)};color:${col(i)}">${ic(AICON[i], Math.round(s * .55))}</span>`;
export const chip = i => `<span class="chip" style="background:${soft(i)};color:${col(i)}"><span class="d" style="background:${col(i)}">${ic(AICON[i], 12)}</span>${SHORT[i]}</span>`;

// Cortes oficiales de niveles de desempeño Saber 11 (se pueden cambiar en ajustes)
export let CORTES = { 0: [35, 50, 65], 1: [35, 50, 70], 2: [40, 55, 70], 3: [40, 55, 70], 4: [47, 57, 70] };
export const setCortes = c => { if (c) CORTES = c; };
export const nivel = (area, v) => { const c = CORTES[area]; return v <= c[0] ? 1 : v <= c[1] ? 2 : v <= c[2] ? 3 : 4; };
export const nivelNombre = (area, n) => area === 4 ? ['Pre A1', 'A1', 'A2', 'B1'][n - 1] : 'Nivel ' + n;
export const lvlTag = (area, v) => { const n = nivel(area, v); return `<span class="lvl c${n}">${nivelNombre(area, n)}</span>`; };
export const globalDe = a => Math.round(((a[0] + a[1] + a[2] + a[3]) * 3 + a[4]) / 13 * 5);

const fmtF = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
const fmtFH = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const fmtH = new Intl.DateTimeFormat('es-CO', { hour: 'numeric', minute: '2-digit' });
export const fecha = d => d ? fmtF.format(new Date(d)) : '';
export const fechaHora = d => d ? fmtFH.format(new Date(d)) : '';
export const hora = d => d ? fmtH.format(new Date(d)) : '';
export const num = n => Number(n ?? 0).toLocaleString('es-CO');
export const iniciales = n => String(n || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();

// ---------- Avisos ----------
export function toast(t, tipo = '') {
  let el = $('#toast');
  el.textContent = t; el.hidden = false; el.dataset.tipo = tipo;
  clearTimeout(toast.h); toast.h = setTimeout(() => el.hidden = true, tipo === 'error' ? 6000 : 3200);
}
export const errorMsg = e => {
  const m = String(e?.message || e || 'Ocurrió un error');
  if (/Failed to fetch|NetworkError|network/i.test(m)) return 'No hay conexión con el servidor. Revise el internet e intente de nuevo.';
  if (/JWT|jwt expired/i.test(m)) return 'Su sesión venció. Vuelva a ingresar.';
  if (/row-level security|permission denied/i.test(m)) return `No tiene permiso para hacer esto. (Detalle: ${m})`;
  if (/duplicate key/i.test(m)) return 'Ese registro ya existe.';
  return m;
};

// ---------- Ventanas ----------
let onCloseCb = null;
export function modal({ icon = 'i-info', tono = 'brand', titulo, sub = '', cuerpo, pie = '', ancho = false, form = false, onClose = null }) {
  const tc = { brand: ['var(--brand-soft)', 'var(--brand)'], ok: ['var(--ok-soft)', 'var(--ok)'], warn: ['var(--warn-soft)', 'var(--warn)'], coral: ['var(--coral-soft)', 'var(--coral-ink)'], bad: ['var(--bad-soft)', 'var(--bad)'] }[tono];
  const inner = `<div class="win ${ancho ? 'wide' : ''}">
    <div class="wh"><span class="wi" style="background:${tc[0]};color:${tc[1]}">${ic(icon, 24)}</span><div><h2 id="wt">${titulo}</h2>${sub ? `<p class="xs muted">${sub}</p>` : ''}</div><button class="x" type="button" data-cerrar aria-label="Cerrar">×</button></div>
    <div class="wb">${cuerpo}</div>${pie ? `<div class="wf">${pie}</div>` : ''}</div>`;
  const box = $('#modalbox');
  box.innerHTML = `<div class="modal" data-velo role="dialog" aria-modal="true" aria-labelledby="wt">${form ? `<form id="mform" novalidate>${inner}</form>` : inner}</div>`;
  document.body.style.overflow = 'hidden';
  onCloseCb = onClose;
  setTimeout(() => { const f = box.querySelector('input:not([type=hidden]):not([type=checkbox]):not([type=radio]),select,textarea'); if (f) f.focus(); }, 30);
  return box.firstElementChild;
}
export function cerrarModal() {
  $('#modalbox').innerHTML = ''; document.body.style.overflow = '';
  if (onCloseCb) { const c = onCloseCb; onCloseCb = null; c(); }
}
document.addEventListener('click', e => {
  if (e.target.closest('[data-cerrar]') || (e.target.matches && e.target.matches('[data-velo]'))) cerrarModal();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('#modalbox').innerHTML) cerrarModal(); });

export function confirmar({ titulo, texto, si = 'Confirmar', tono = 'warn', icon = 'i-warn', peligro = false }) {
  return new Promise(res => {
    const w = modal({ icon, tono, titulo, cuerpo: `<p>${texto}</p>`, pie: `<button class="btn sec" type="button" data-no>Cancelar</button><button class="btn ${peligro ? 'hot' : 'pri'}" type="button" data-si ${peligro ? 'style="background:var(--bad)"' : ''}>${si}</button>`, onClose: () => res(false) });
    w.querySelector('[data-si]').onclick = () => { onCloseCb = null; cerrarModal(); res(true); };
    w.querySelector('[data-no]').onclick = () => cerrarModal();
  });
}

// ---------- Piezas de interfaz ----------
// Franja de color al inicio de cada pantalla. «volver» va arriba del título; «derecha», los botones.
export const head = (eyebrow, titulo, derecha = '', { volver = '', sub = '' } = {}) => `<section class="band"><i class="blob b1"></i><i class="blob b2"></i><div class="band-in"><div class="t">${volver}${eyebrow ? `<span class="chipe">${eyebrow}</span>` : ''}<h1>${titulo}</h1>${sub ? `<p>${sub}</p>` : ''}</div>${derecha ? `<div class="acts">${derecha}</div>` : ''}</div></section>`;
export const volverBtn = (ruta, texto) => `<button class="volver" type="button" data-ir="${ruta}">← ${texto}</button>`;
// Notas en la escala del colegio
export const notaTxt = (n, d = 1) => n == null || n === '' ? '—' : Number(n).toLocaleString('es-CO', { minimumFractionDigits: d, maximumFractionDigits: d });
export const notaCls = (n, esc) => n == null ? 'mute' : Number(n) >= Number(esc?.aprobar ?? esc?.nota_aprobar ?? 3) ? 'ok' : 'bad';
export const notaHTML = (n, esc) => `<span class="nota ${notaCls(n, esc)}">${notaTxt(n, esc?.decimales ?? 1)}</span>`;
// El color de la franja y los botones es el del colegio
export function aplicarColor(hex) {
  const c = /^#[0-9a-f]{6}$/i.test(hex || '') ? hex : '#0F6F74';
  document.documentElement.style.setProperty('--brand-base', c);
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', c);
}
// Foto de fondo (la del colegio o la de la entrada)
export function aplicarFondo(url) {
  if (url) document.documentElement.style.setProperty('--fondo', `url("${String(url).replace(/["\\]/g, '')}")`);
  else document.documentElement.style.removeProperty('--fondo');
}
export const notaRoja = (n, d = 1, sub = '', size = 170) => `<span class="nota-roja" style="width:${size}px;height:${Math.round(size * .86)}px;--nz:${Math.round(size * .32)}px" role="img" aria-label="Nota ${notaTxt(n, d)} ${esc(sub)}"><svg viewBox="0 0 100 86" aria-hidden="true"><path d="M58 6C84 6 98 24 95 44c-3 22-26 37-50 36C20 79 3 64 5 42 7 20 28 6 52 8c10 1 18 4 24 8"/></svg><span><b>${notaTxt(n, d)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</span></span>`;
export const confeti = (n = 26) => `<div class="confeti" aria-hidden="true">${Array.from({ length: n }, (_, i) => `<i style="left:${(i * 37) % 100}%;top:${(i * 13) % 35}%;background:${['#FF9A7A', '#FFD166', '#9BE7BF', '#FFFFFF', '#8C9BF0'][i % 5]};animation-delay:${(i % 7) * .09}s"></i>`).join('')}</div>`;
export const GRADOS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
export const gradoTxt = g => `${g}.°`;
export const kpi = (icon, c, cs, v, d) => `<div class="card kpi"><span class="ico" style="background:${cs};color:${c}">${ic(icon, 22)}</span><div><div class="v">${v}</div><div class="d">${d}</div></div></div>`;
export const cargando = (t = 'Cargando…') => `<div class="card" style="place-items:center;padding:48px"><div class="spin"></div><span class="muted small">${t}</span></div>`;
export const vacio = (icon, titulo, texto = '', accion = '') => `<div class="empty">${`<span class="aico" style="width:56px;height:56px;background:var(--surface-2);color:var(--muted)">${ic(icon, 26)}</span>`}<b>${titulo}</b>${texto ? `<span class="small muted">${texto}</span>` : ''}${accion}</div>`;
export const pill = (t, c = 'p-mute') => `<span class="pill ${c}">${t}</span>`;
export const field = (id, label, val = '', extra = '', hint = '') => `<div class="field"><label for="${id}">${label}</label><input id="${id}" name="${id}" value="${esc(val)}" ${extra}>${hint ? `<span class="hint">${hint}</span>` : ''}</div>`;
export const selectField = (id, label, opts, val = '', hint = '') => `<div class="field"><label for="${id}">${label}</label><select id="${id}" name="${id}">${opts.map(o => { const [v, t] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}" ${String(v) === String(val) ? 'selected' : ''}>${esc(t)}</option>`; }).join('')}</select>${hint ? `<span class="hint">${hint}</span>` : ''}</div>`;
export const corp = `<footer class="corp"><span class="by">Desarrollado por</span><span class="sig"><svg width="20" height="23" aria-hidden="true"><use href="#logo"/></svg><span class="name">Fortalecer <span>Company</span></span></span></footer>`;
export const escudo = (url, nombre, s = 40) => url ? `<img src="${esc(url)}" alt="Escudo" style="width:${s}px;height:${s}px;object-fit:contain;flex:none">` : `<span class="crest" style="width:${s}px;height:${s}px;font-size:${Math.round(s / 3)}px">${esc(iniciales(nombre))}</span>`;
export const lvLegend = `<div class="legend"><span><i class="l1"></i>Nivel 1</span><span><i class="l2"></i>Nivel 2</span><span><i class="l3"></i>Nivel 3</span><span><i class="l4"></i>Nivel 4</span></div>`;
export const barra = (v, color = 'var(--brand)', max = 100) => `<div class="bar"><i style="width:${Math.max(0, Math.min(100, v / max * 100))}%;background:${color}"></i></div>`;
export function heat(filas, cols, val) {
  const c = v => v == null ? 'var(--sunk)' : v < 40 ? 'var(--n1)' : v < 50 ? 'var(--n2)' : v < 60 ? 'var(--n3)' : 'var(--n4)';
  return `<div class="tw"><table class="heat"><thead><tr><th></th>${cols.map(x => `<th class="r">${esc(x)}</th>`).join('')}</tr></thead><tbody>${filas.map((r, i) => `<tr><th style="text-align:left">${esc(r)}</th>${cols.map((x, j) => { const v = val(i, j); return `<td><span class="hcell" style="background:${c(v)};${v == null ? 'color:var(--muted)' : ''}" title="${esc(r)} · ${esc(x)}: ${v ?? '—'}">${v ?? '—'}</span></td>`; }).join('')}</tr>`).join('')}</tbody></table></div>`;
}
export function rings5(vals, size = 190, centro = '', sub = '') {
  const cx = size / 2, sw = size * 0.052, gap = sw * 1.45; let g = '';
  AREAS.forEach((a, i) => {
    const r = cx - sw / 2 - 4 - i * gap, C = 2 * Math.PI * r, v = vals[i] || 0;
    g += `<circle cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke="${soft(i)}" stroke-width="${sw}"/><circle class="ringarc" cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke="${col(i)}" stroke-width="${sw}" stroke-linecap="round" stroke-dasharray="${C * v / 100} ${C}" transform="rotate(-90 ${cx} ${cx})"><title>${a}: ${v}</title></circle>`;
  });
  if (centro !== '') g += `<text x="${cx}" y="${cx + 4}" text-anchor="middle" style="font:700 ${size * 0.13}px Fraunces,Georgia,serif;fill:var(--ink)">${centro}</text><text x="${cx}" y="${cx + size * 0.1}" text-anchor="middle" style="font-size:${size * 0.055}px;fill:var(--muted)">${sub}</text>`;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="Anillos de las cinco áreas">${g}</svg>`;
}

// ---------- Descargas ----------
export function descargarCSV(nombre, filas) {
  const csv = filas.map(r => r.map(v => { const s = String(v ?? ''); return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(';')).join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  bajar(blob, nombre.endsWith('.csv') ? nombre : nombre + '.csv');
}
export function descargarExcel(nombre, hojas) {
  if (!window.XLSX) return toast('No se pudo cargar el generador de Excel. Revise la conexión.', 'error');
  const wb = XLSX.utils.book_new();
  for (const [titulo, filas] of Object.entries(hojas)) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(filas), titulo.slice(0, 31));
  XLSX.writeFile(wb, nombre.endsWith('.xlsx') ? nombre : nombre + '.xlsx');
}
export function descargarWord(nombre, html) {
  const doc = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>${esc(nombre)}</title></head><body style="font-family:Arial">${html}</body></html>`;
  bajar(new Blob(['﻿' + doc], { type: 'application/msword' }), nombre.endsWith('.doc') ? nombre : nombre + '.doc');
}
function bajar(blob, nombre) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nombre;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
export function imprimir(html, titulo = 'Reporte FORTALECER') {
  const box = $('#printbox'); box.innerHTML = html; document.title = titulo;
  setTimeout(() => { window.print(); }, 60);
}
export function leerExcel(file) {
  return new Promise((res, rej) => {
    if (!window.XLSX) return rej(new Error('No se pudo cargar el lector de Excel. Revise la conexión.'));
    const fr = new FileReader();
    fr.onload = () => { try { const wb = XLSX.read(fr.result, { type: 'array' }); const ws = wb.Sheets[wb.SheetNames[0]]; res(XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })); } catch (e) { rej(e); } };
    fr.onerror = () => rej(fr.error); fr.readAsArrayBuffer(file);
  });
}
export const normal = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
