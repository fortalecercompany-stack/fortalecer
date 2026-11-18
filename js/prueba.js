// FORTALECER · el estudiante presenta un examen de su docente
// Siete tipos de pregunta, una por pantalla o todas juntas, sin conexión y con control contra la copia si el docente lo activó.
import { $, $$, esc, ic, toast, errorMsg, modal, cerrarModal, cargando, corp, hora, fechaHora, notaTxt, notaRoja, confeti, head, volverBtn } from './lib.js';
import { rpc } from './api.js';

const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } },
  del(k) { try { localStorage.removeItem(k); } catch { } },
};
let X = null, reloj = null, sincro = null;
const TXT_INC = { salida: 'Salió de la ventana del examen', pantalla_completa: 'Salió de la pantalla completa', captura: 'Intentó tomar una captura de pantalla', copiar: 'Intentó copiar el contenido', imprimir: 'Intentó imprimir' };
const vigilando = () => X && X.vig && X.d.antifraude && !X.fin_ok && document.body.classList.contains('focus');

export async function prueba({ S, main, params, go }) {
  clearInterval(reloj); clearInterval(sincro);
  const id = params[0];
  main.innerHTML = cargando('Preparando su examen…');
  let d;
  try { d = await rpc('est_iniciar_examen', { p_examen: id }); LS.set('f-pd-' + id, d); }
  catch (e) {
    const c = LS.get('f-pd-' + id, null);
    if (c && /conexión|fetch|network/i.test(errorMsg(e))) { d = c; toast('Sin conexión: se abrió la copia guardada en este equipo.'); }
    else { main.innerHTML = `${head('Examen', 'No se puede abrir', '', { volver: volverBtn('inicio', 'Inicio') })}<div class="card"><div class="alert a-warn">${ic('i-warn')}<div><b>No se puede abrir el examen</b>${esc(errorMsg(e))}</div></div></div>${corp}`; return; }
  }
  const k = 'f-pr-' + d.intento;
  X = { S, main, go, id, d, k, resp: { ...(d.respuestas || {}), ...LS.get(k + 'r', {}) }, pend: LS.get(k + 'p', {}), cola: LS.get(k + 'i', []),
    adv: d.advertencias || 0, i: 0, offset: new Date(d.ahora) - Date.now(), fin: new Date(d.fin).getTime(), online: navigator.onLine, vig: false, ult: 0, fin_ok: false };
  X.i = Math.max(0, d.preguntas.findIndex(p => !respondida(p)));
  reglas(d.reingresos > 0 || Object.keys(X.resp).length > 0);
  reloj = setInterval(tic, 1000);
  sincro = setInterval(() => sync(false), 20000);
}
const restante = () => Math.max(0, Math.floor((X.fin - (Date.now() + X.offset)) / 1000));
const fmt = s => { const h = Math.floor(s / 3600), m = String(Math.floor(s % 3600 / 60)).padStart(2, '0'), x = String(s % 60).padStart(2, '0'); return h ? `${h}:${m}:${x}` : `${m}:${x}`; };
function tic() {
  if (!X || !document.body.contains(X.main) || X.fin_ok) { clearInterval(reloj); return; }
  const s = restante(), el = $('#tm'); if (el) el.textContent = fmt(s);
  if (s <= 0) { toast('Se terminó el tiempo. Su examen se entregó con lo que tenía.'); entregar(); }
  else if (s === 300) toast('Quedan 5 minutos.');
}
function respondida(p) {
  const r = X.resp[p.id];
  if (r == null || r === '') return false;
  if (Array.isArray(r)) return r.length > 0;
  if (typeof r === 'object') return Object.keys(r).length > 0;
  return true;
}

function reglas(reingreso) {
  const { d, main } = X;
  document.body.classList.remove('focus');
  main.innerHTML = `${head(`${esc(d.materia || 'Examen')} · ${esc(d.docente)}`, esc(d.titulo), '', { sub: `${d.preguntas.length} preguntas · tiene hasta las <b>${hora(new Date(X.fin))}</b>${d.intentos > 1 ? ` · intento ${d.numero} de ${d.intentos}` : ''}` })}
    <div class="card" style="max-width:760px">
      ${reingreso ? `<div class="alert a-warn">${ic('i-warn')}<div><b>Está volviendo a entrar</b>Sus respuestas se conservan${X.adv ? ` y ya tiene ${X.adv} advertencia` : ''}.</div></div>` : ''}
      ${d.instrucciones ? `<div><span class="lbl">Instrucciones del docente</span><p>${esc(d.instrucciones).replace(/\n/g, '<br>')}</p></div>` : ''}
      <ol class="reglas-lista">
        ${d.antifraude ? `<li><b>No salga de esta ventana</b> ni abra otras pestañas o aplicaciones. No tome capturas, no copie ni imprima.</li><li>La primera vez recibirá una <b>advertencia</b>. La segunda, <b>el examen se cierra solo</b> y se le informa a su docente.</li>` : '<li>Responda con calma. Puede moverse entre las preguntas.</li>'}
        <li>Si se va el internet, siga respondiendo: sus respuestas se guardan en este equipo y se envían solas.</li>
        <li>Al entregar verá su nota de inmediato.${d.taller ? ' Es un taller de práctica: no cuenta para la nota del período.' : ''}</li>
      </ol>
      <div class="row"><button class="btn hot" type="button" id="empezar">${ic('i-play', 18)}${reingreso ? 'Continuar' : 'Empezar'}</button><button class="btn ghost" type="button" data-ir="inicio">Ahora no</button></div></div>${corp}`;
  $('#empezar').onclick = () => { X.vig = true; document.body.classList.add('focus'); if (d.antifraude) pantallaCompleta(); pintar(); };
  document.dispatchEvent(new Event('f-pintado'));
}
function pantallaCompleta() { const el = document.documentElement; if (el.requestFullscreen && !document.fullscreenElement) el.requestFullscreen({ navigationUI: 'hide' }).then(() => X.fs = true).catch(() => { }); }
function salirPC() { try { if (document.fullscreenElement) document.exitFullscreen(); } catch { } if (X) X.fs = false; }

// ---------- Pintar las preguntas ----------
function preguntaHTML(p, solo) {
  const r = X.resp[p.id], L = p.lectura ? X.d.lecturas[p.lectura] : null;
  let cuerpo = '';
  if (p.tipo === 'una' || p.tipo === 'varias') cuerpo = `<div class="opts" role="${p.tipo === 'una' ? 'radiogroup' : 'group'}">${p.opciones.map((o, j) => { const on = p.tipo === 'una' ? r === o.k : (r || []).includes(o.k);
    return `<button type="button" class="opt" role="${p.tipo === 'una' ? 'radio' : 'checkbox'}" aria-checked="${on}" data-p="${p.id}" data-o="${o.k}"><span class="k">${'ABCDEF'[j]}</span><span>${esc(o.t)}</span></button>`; }).join('')}</div>${p.tipo === 'varias' ? '<p class="xs muted">Marque todas las que sean correctas. Las incorrectas descuentan.</p>' : ''}`;
  if (p.tipo === 'vf') cuerpo = `<div class="vfb">${[['V', 'Verdadero'], ['F', 'Falso']].map(([k, t]) => `<button type="button" class="opt" role="radio" aria-checked="${r === k}" data-p="${p.id}" data-o="${k}" style="justify-content:center"><span class="k">${k}</span><span>${t}</span></button>`).join('')}</div>`;
  let enun = esc(p.enunciado).replace(/\n/g, '<br>');
  if (p.tipo === 'completar') {
    const inp = `<input class="blank-in" data-comp="${p.id}" value="${esc(r || '')}" maxlength="120" autocomplete="off" aria-label="Respuesta" placeholder="Escriba aquí">`;
    if (/_{3,}/.test(enun)) enun = enun.replace(/_{3,}/, inp); else cuerpo = inp;
  }
  if (p.tipo === 'relacionar') cuerpo = `<div class="pares">${p.izq.map((a, j) => `<div class="par ${r && r[j] ? 'lleno' : ''}"><b>${esc(a)}</b><select data-rel="${p.id}" data-j="${j}" aria-label="Pareja de ${esc(a)}"><option value="">Elija…</option>${p.fichas.map(f => `<option value="${f.k}" ${r && r[j] === f.k ? 'selected' : ''}>${esc(f.t)}</option>`).join('')}</select></div>`).join('')}</div>`;
  if (p.tipo === 'ordenar') {
    const orden = Array.isArray(r) && r.length === p.fichas.length ? r : p.fichas.map(f => f.k);
    const T = Object.fromEntries(p.fichas.map(f => [f.k, f.t]));
    cuerpo = `<ol class="pasos-ord">${orden.map((kk, j) => `<li><span class="ix">${j + 1}</span><span>${esc(T[kk])}</span><span class="mv"><button class="ibtn" type="button" data-ord="${p.id}" data-j="${j}" data-d="-1" aria-label="Subir" ${j === 0 ? 'disabled' : ''}>↑</button><button class="ibtn" type="button" data-ord="${p.id}" data-j="${j}" data-d="1" aria-label="Bajar" ${j === orden.length - 1 ? 'disabled' : ''}>↓</button></span></li>`).join('')}</ol>
      ${!respondida(p) ? `<button class="btn sec sm" type="button" data-ordok="${p.id}" style="justify-self:start">Este es mi orden</button>` : '<p class="xs muted">Use las flechas para cambiar el orden.</p>'}`;
  }
  const lec = L ? `<div class="lectura">${L.titulo ? `<b class="tt">${esc(L.titulo)}</b>` : ''}${L.texto ? `<div>${esc(L.texto).replace(/\n/g, '<br>')}</div>` : ''}${L.imagen_url ? `<img src="${esc(L.imagen_url)}" alt="Imagen de la lectura" style="max-width:100%;border-radius:14px">` : ''}</div>` : '';
  return `<article class="qcard" id="p${p.n}">
    <div class="qmeta"><div class="row" style="gap:14px"><span class="qnum">${String(p.n).padStart(2, '0')}</span><div><span class="xs muted">Pregunta ${p.n} de ${X.d.preguntas.length}</span><br><span class="xs muted">Vale ${notaTxt(p.valor, Number.isInteger(+p.valor) ? 0 : 1)} ${+p.valor === 1 ? 'punto' : 'puntos'}</span></div></div>${respondida(p) ? `<span class="pill p-ok">Respondida</span>` : ''}</div>
    ${solo ? lec : ''}${p.imagen_url ? `<img src="${esc(p.imagen_url)}" alt="Imagen de la pregunta ${p.n}" style="max-width:100%;border-radius:14px;border:1px solid var(--line);background:#fff">` : ''}
    <div class="stem"><p>${enun}</p></div>${cuerpo}</article>`;
}
function pintar() {
  if (X.fin_ok) return;
  const { d, main } = X, n = d.preguntas.filter(respondida).length, total = d.preguntas.length;
  const barra = `<div class="fbar"><div class="l"><span class="small"><b>${esc(d.titulo)}</b><br><span class="xs muted">${esc(d.materia || '')}</span></span></div>
    <div class="row">${syncHTML()}<span class="timer" aria-label="Tiempo restante">${ic('i-clock', 18)}<span id="tm">${fmt(restante())}</span></span></div></div>`;
  const mapa = `<aside class="qnav card"><div class="row between"><h3>Mis preguntas</h3><span class="xs muted num">${n} de ${total}</span></div><div class="dots">${d.preguntas.map((p, j) => `<button type="button" class="${respondida(p) ? 'ans' : ''} ${j === X.i && d.presentacion === 'una' ? 'cur' : ''}" data-q="${j}" style="${respondida(p) ? 'background:var(--brand)' : ''}" aria-label="Pregunta ${p.n}">${p.n}</button>`).join('')}</div>
    <button class="btn hot" type="button" data-entregar>Entregar</button></aside>`;
  let centro;
  if (d.presentacion === 'todas') {
    let vistas = new Set();
    centro = `<div class="qtodas">${d.preguntas.map(p => { let pre = ''; if (p.lectura && !vistas.has(p.lectura)) { vistas.add(p.lectura); const L = d.lecturas[p.lectura]; pre = `<div class="lectura">${L.titulo ? `<b class="tt">${esc(L.titulo)}</b>` : ''}${L.texto ? `<div>${esc(L.texto).replace(/\n/g, '<br>')}</div>` : ''}${L.imagen_url ? `<img src="${esc(L.imagen_url)}" alt="" style="max-width:100%;border-radius:14px">` : ''}</div>`; } return pre + preguntaHTML(p, false); }).join('')}
      <button class="btn hot" type="button" data-entregar style="justify-self:start">Entregar el examen</button></div>`;
  } else {
    const p = d.preguntas[X.i];
    centro = `<div style="display:grid;gap:14px;min-width:0">${preguntaHTML(p, true)}</div>`;
  }
  main.innerHTML = `${barra}<div class="exam">${centro}${mapa}</div>${d.presentacion === 'una' ? `<div class="abar"><button class="btn sec" type="button" data-mv="-1" ${X.i === 0 ? 'disabled' : ''}>← Anterior</button><span class="small muted num">${X.i + 1} / ${total}</span><button class="btn pri" type="button" data-mv="1">${X.i === total - 1 ? 'Revisar y entregar' : 'Siguiente →'}</button></div>` : ''}${d.antifraude ? marca() : ''}`;
  main.onclick = clic; main.onchange = cambio; main.oninput = escribe;
}
function marca() {
  const p = X.S.perfil, t = `${p.nombres} ${p.apellidos} · ${p.documento || ''}`.replace(/[<>&"]/g, '');
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='420' height='220'><text x='10' y='120' transform='rotate(-24 210 110)' font-family='sans-serif' font-size='15' font-weight='700' fill='%23808080'>${encodeURIComponent(t)}</text></svg>`;
  return `<div class="marca-agua" aria-hidden="true" style="background-image:url(&quot;data:image/svg+xml;utf8,${svg}&quot;)"></div>`;
}
const syncHTML = () => { const n = Object.keys(X.pend).length; return !X.online || n ? `<span id="sync" class="sync" style="background:var(--warn-soft);color:var(--warn)">${ic('i-offline', 15)}${X.online ? 'Guardando…' : 'Sin conexión'}</span>` : `<span id="sync" class="sync" style="background:var(--ok-soft);color:var(--ok)">${ic('i-sync', 15)}Todo guardado</span>`; };
const estadoSync = () => { const el = $('#sync'); if (el) el.outerHTML = syncHTML(); };

function poner(pid, v, repintar = true) {
  X.resp[pid] = v; X.pend[pid] = v;
  LS.set(X.k + 'r', X.resp); LS.set(X.k + 'p', X.pend);
  if (repintar) { const y = scrollY; pintar(); scrollTo(0, y); }
  clearTimeout(X.deb); X.deb = setTimeout(() => sync(false), 1500);
}
const preg = id => X.d.preguntas.find(p => p.id === id);
function clic(e) {
  const b = e.target.closest('button'); if (!b) return; const d = b.dataset;
  if (d.o) { const p = preg(d.p); if (p.tipo === 'varias') { const a = new Set(X.resp[p.id] || []); a.has(d.o) ? a.delete(d.o) : a.add(d.o); poner(p.id, [...a].sort()); } else poner(p.id, d.o); return; }
  if (d.ord) { const p = preg(d.ord), a = Array.isArray(X.resp[p.id]) && X.resp[p.id].length === p.fichas.length ? [...X.resp[p.id]] : p.fichas.map(f => f.k), i = +d.j, j = i + +d.d; [a[i], a[j]] = [a[j], a[i]]; return poner(p.id, a); }
  if (d.ordok) { const p = preg(d.ordok); return poner(p.id, p.fichas.map(f => f.k)); }
  if (d.q !== undefined) { if (X.d.presentacion === 'todas') return $('#p' + X.d.preguntas[+d.q].n)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); X.i = +d.q; pintar(); scrollTo(0, 0); return; }
  if (d.mv) { const j = X.i + +d.mv; if (j >= X.d.preguntas.length) return pedirEntrega(); if (j < 0) return; X.i = j; pintar(); scrollTo(0, 0); return; }
  if ('entregar' in d) return pedirEntrega();
}
function cambio(e) {
  const t = e.target;
  if (t.dataset.rel) { const p = preg(t.dataset.rel), r = { ...(X.resp[p.id] || {}) }; if (t.value) r[t.dataset.j] = t.value; else delete r[t.dataset.j]; poner(p.id, r); }
}
function escribe(e) { const t = e.target; if (t.dataset.comp) poner(t.dataset.comp, t.value.slice(0, 120), false); }

// ---------- Guardar y control contra la copia ----------
async function sync(entregar) {
  if (!X) return false;
  const pend = { ...X.pend };
  try {
    while (X.cola.length) {
      const r = await rpc('est_incidente_doc', X.cola[0]); X.cola.shift(); LS.set(X.k + 'i', X.cola);
      if (r?.cerrado) X.cerrado = true;
    }
    if (Object.keys(pend).length || entregar || X.cerrado) {
      const r = await rpc('est_guardar_examen', { p_intento: X.d.intento, p_resp: entregar ? X.resp : pend, p_entregar: !!entregar });
      for (const k of Object.keys(pend)) if (X.pend[k] === pend[k]) delete X.pend[k];
      LS.set(X.k + 'p', X.pend);
      if (r?.hora) X.offset = new Date(r.hora) - Date.now();
      if (r?.fin) X.fin = new Date(r.fin).getTime();
      X.online = true; estadoSync();
      if (r?.estado === 'entregado') { terminar(r); return true; }
    }
    X.online = true; estadoSync(); return true;
  } catch { X.online = false; estadoSync(); return false; }
}
function incidente(tipo, detalle = null, cuenta = true) {
  if (!X || X.fin_ok) return;
  if (cuenta) { if (!vigilando()) return; const t = Date.now(); if (t - X.ult < 2500) return; X.ult = t; X.adv++; }
  X.cola.push({ p_intento: X.d.intento, p_tipo: tipo, p_detalle: detalle, p_cuenta: cuenta }); LS.set(X.k + 'i', X.cola);
  if (cuenta && X.adv >= 2) { X.cerrado = true; salirPC(); sync(true); return; }
  if (cuenta) advertir(tipo);
  sync(false);
}
function advertir(tipo) {
  const v = document.createElement('div'); v.className = 'fraude'; v.setAttribute('role', 'alertdialog'); v.setAttribute('aria-modal', 'true');
  v.innerHTML = `<div class="fraude-in"><span class="fraude-ico">${ic('i-warn', 34)}</span><span class="eyebrow" style="color:var(--bad)">Primera y única advertencia</span><h2>${TXT_INC[tipo] || 'Acción no permitida'}</h2>
    <p>Quedó registrado y su docente puede verlo. <b>Si vuelve a pasar, el examen se cerrará solo.</b></p><button class="btn hot" type="button" id="volverP">Entiendo, volver al examen</button></div>`;
  document.body.appendChild(v);
  v.querySelector('#volverP').onclick = () => { v.remove(); pantallaCompleta(); };
}
addEventListener('blur', () => { if (vigilando() && !$('.fraude')) setTimeout(() => { if (!document.hasFocus()) incidente('salida'); }, 300); });
document.addEventListener('visibilitychange', () => { if (document.hidden && vigilando()) incidente('salida'); });
document.addEventListener('fullscreenchange', () => { if (X?.fs && !document.fullscreenElement) { X.fs = false; if (vigilando()) incidente('pantalla_completa'); } });
addEventListener('beforeprint', () => { if (vigilando()) incidente('imprimir'); });
['copy', 'cut'].forEach(ev => document.addEventListener(ev, e => { if (!vigilando()) return; e.preventDefault(); incidente('copiar'); }, true));
document.addEventListener('contextmenu', e => { if (vigilando()) e.preventDefault(); }, true);
document.addEventListener('keyup', e => { if ((e.key || '').toLowerCase() === 'printscreen' && vigilando()) incidente('captura'); }, true);
addEventListener('offline', () => { if (X && !X.fin_ok) { X.online = false; X.off = Date.now(); estadoSync(); } });
addEventListener('online', () => { if (X && !X.fin_ok) { if (X.off) incidente('desconexion', Math.max(1, Math.round((Date.now() - X.off) / 60000)) + ' min', false); X.off = 0; sync(!!X.entregando); } });

function pedirEntrega() {
  const total = X.d.preguntas.length, n = X.d.preguntas.filter(respondida).length;
  const w = modal({ icon: 'i-exam', tono: 'coral', titulo: '¿Entregar el examen?', sub: 'Después de entregar no podrá cambiar respuestas.',
    cuerpo: `<div class="alert ${n < total ? 'a-warn' : 'a-ok'}">${ic(n < total ? 'i-warn' : 'i-sync')}<div><b>Respondió ${n} de ${total} preguntas</b>${n < total ? 'Aún tiene preguntas sin responder.' : 'Respondió todas.'}</div></div>`,
    pie: `<button class="btn sec" type="button" data-cerrar>Seguir respondiendo</button><button class="btn hot" type="button" id="siE">Sí, entregar</button>` });
  w.querySelector('#siE').onclick = () => { cerrarModal(); entregar(); };
}
async function entregar() {
  if (X.entregando) return; X.entregando = true;
  clearInterval(reloj); salirPC();
  X.main.innerHTML = cargando('Entregando y calificando…');
  const ok = await sync(true);
  if (!ok) X.main.innerHTML = `<div class="card" style="max-width:600px;margin:20px auto"><div class="alert a-warn">${ic('i-offline')}<div><b>Su entrega se enviará cuando vuelva la conexión</b>No cierre esta página. Sus respuestas están guardadas en este equipo.</div></div><button class="btn pri" type="button" id="reint">Intentar de nuevo</button></div>`;
  $('#reint')?.addEventListener('click', () => { X.entregando = false; entregar(); });
}
function terminar(r) {
  X.fin_ok = true; clearInterval(reloj); clearInterval(sincro);
  document.querySelectorAll('.fraude').forEach(x => x.remove());
  ['r', 'p', 'i'].forEach(s => LS.del(X.k + s)); LS.del('f-pd-' + X.id);
  document.body.classList.remove('focus'); salirPC();
  const d = r.decimales, otro = r.numero < r.intentos && !r.sospecha && Date.now() < X.fin;
  const msg = r.sospecha ? 'Su examen se cerró por salir de la ventana después de la advertencia. Su docente fue informado y es quien puede habilitarlo.' : r.aprobado ? `¡Muy bien! Aprobó. Acertó ${r.buenas} de ${r.total} preguntas.` : `Acertó ${r.buenas} de ${r.total} preguntas. Revise los temas y siga practicando.`;
  X.main.innerHTML = `<section class="band"><i class="blob b1"></i><i class="blob b2"></i>${r.aprobado && !r.sospecha ? confeti() : ''}<div class="band-in"><div class="t"><span class="chipe">${esc(r.materia || 'Examen')}</span><h1>${r.sospecha ? 'Examen cerrado' : r.aprobado ? '¡Lo logró!' : 'Examen entregado'}</h1><p>${msg}</p>
      ${r.intentos > 1 ? `<p>Intento ${r.numero} de ${r.intentos}. Nota que cuenta: <b>${notaTxt(r.nota_final, d)}</b>.</p>` : ''}
      <div class="acts"><button class="btn pri" type="button" data-ir="inicio">Volver al inicio</button>${otro ? `<button class="btn sec" type="button" data-otro>Usar otro intento</button>` : ''}<button class="btn sec" type="button" data-ir="notas">Mis notas</button></div></div>
      <div class="hoja-nota">${notaRoja(r.nota, d, `de ${notaTxt(r.escala_max, d)}`, 190)}</div></div></section>
    <div class="card"><p class="small muted">${r.mostrar_respuestas ? `Podrá revisar qué acertó y cuál era la respuesta correcta cuando el examen se cierre para todo el grupo${r.revision_desde ? ` (${fechaHora(r.revision_desde)})` : ''}, en <b>Mis notas</b>.` : 'Su docente decidió no mostrar las respuestas de este examen.'}</p></div>${corp}`;
  X.main.onclick = e => { if (e.target.closest('[data-otro]')) X.go('prueba/' + X.id); };
  document.dispatchEvent(new Event('f-pintado'));
}

// ---------- Revisión cuando el examen cerró ----------
export async function revision({ main, params }) {
  main.innerHTML = cargando();
  try {
    const R = await rpc('est_revision_doc', { p_intento: params[0] });
    main.innerHTML = `${head(esc(R.materia || 'Examen'), `Revisión: ${esc(R.titulo)}`, '', { volver: volverBtn('notas', 'Mis notas'), sub: `Nota: <b>${notaTxt(R.nota, 1)}</b>${R.numero > 1 ? ` · intento ${R.numero}` : ''}` })}
      <div style="display:grid;gap:12px">${R.preguntas.map(p => { const c = p.puntaje >= 1 ? 'bien' : p.puntaje <= 0 ? 'mal' : 'medio';
        return `<div class="revq ${c}"><div class="row between"><b>Pregunta ${p.n}</b><span class="pill ${c === 'bien' ? 'p-ok' : c === 'mal' ? 'p-bad' : 'p-warn'}">${c === 'bien' ? 'Correcta' : c === 'mal' ? 'Incorrecta' : `Parcial · ${Math.round(p.puntaje * 100)}%`}</span></div>
          ${p.lectura ? `<span class="xs muted">Lectura: ${esc(p.lectura)}</span>` : ''}<p>${esc(p.enunciado)}</p>${p.imagen_url ? `<img class="thumbq" src="${esc(p.imagen_url)}" alt="">` : ''}
          <span class="small"><b>Su respuesta:</b> ${esc(p.respuesta || 'Sin responder')}</span>${c !== 'bien' ? `<span class="small" style="color:var(--ok)"><b>Correcta:</b> ${esc(p.correcta || '')}</span>` : ''}${p.explicacion ? `<span class="small muted">${esc(p.explicacion)}</span>` : ''}</div>`; }).join('')}</div>${corp}`;
  } catch (e) { main.innerHTML = `${head('Revisión', 'Aún no disponible', '', { volver: volverBtn('notas', 'Mis notas') })}<div class="card"><div class="alert a-info">${ic('i-info')}<div><b>Todavía no se puede revisar</b>${esc(errorMsg(e))}</div></div></div>${corp}`; }
}
