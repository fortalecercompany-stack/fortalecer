// FORTALECER · pantallas del estudiante
import { $, $$, esc, ic, AREAS, SHORT, AICON, col, soft, aico, chip, toast, errorMsg, modal, cerrarModal, confirmar, head, cargando, vacio, corp, rings5, lvlTag, nivel, nivelNombre, fechaHora, hora, fecha, barra, iniciales } from './lib.js';
import { sb, rpc } from './api.js';

export async function render(ctx) {
  const { seccion } = ctx;
  if (seccion === 'examen') return examen(ctx);
  if (seccion === 'resultados') return resultados(ctx);
  if (seccion === 'perfil') return perfil(ctx);
  return inicio(ctx);
}

const ESTADO = { proxima: ['Próximo', 'p-info'], abierta: ['Abierto', 'p-ok'], entregado: ['Entregado', 'p-brand'], cerrada: ['Terminado', 'p-mute'] };

async function inicio({ S, main, go }) {
  main.innerHTML = cargando();
  const [apl, res] = await Promise.all([rpc('mis_aplicaciones'), rpc('mis_resultados').catch(() => [])]);
  const abierta = apl.find(a => a.estado === 'abierta');
  const proxima = apl.filter(a => a.estado === 'proxima').sort((a, b) => new Date(a.inicio) - new Date(b.inicio))[0];
  const ult = res[0];
  const nombre = esc(S.perfil.nombres.split(' ')[0]);
  const heroTxt = abierta
    ? `<h1>${nombre}, el ${esc(abierta.nombre)} ya está abierto.</h1><p>125 preguntas de las 5 áreas, en una sola sesión. Tiene hasta las ${hora(abierta.fin)}. Si se va el internet, siga respondiendo: sus respuestas se guardan.</p>
       <div class="row">${S.perfil.autorizacion_acudiente ? `<button class="btn hot" type="button" data-examen="${abierta.id}">${ic('i-exam')}${abierta.respondidas ? 'Continuar simulacro' : 'Empezar simulacro'}</button>` : `<span class="pill p-warn">Falta la autorización del acudiente</span>`}</div>`
    : proxima ? `<h1>${nombre}, su próximo simulacro es el ${fecha(proxima.inicio)}.</h1><p>${esc(proxima.nombre)} · empieza a las ${hora(proxima.inicio)}.</p>`
    : `<h1>Hola, ${nombre}.</h1><p>Por ahora no tiene simulacros abiertos. Cuando la coordinación programe uno, aparecerá aquí.</p>`;
  const lista = apl.length ? apl.map(a => { const [t, c] = ESTADO[a.estado]; return `<div class="row between" style="padding-block:10px;border-bottom:1px solid var(--line)"><div class="row" style="gap:12px;flex-wrap:nowrap"><span class="aico" style="background:var(--surface-2);color:var(--brand)">${ic('i-exam', 20)}</span><div><b>${esc(a.nombre)}</b><div class="xs muted">${fechaHora(a.inicio)} a ${hora(a.fin)}</div></div></div>${a.estado === 'abierta' && S.perfil.autorizacion_acudiente ? `<button class="btn pri sm" type="button" data-examen="${a.id}">${a.respondidas ? 'Continuar' : 'Empezar'}</button>` : `<span class="pill ${c}">${t}</span>`}</div>`; }).join('') : vacio('i-cal', 'Sin simulacros todavía');
  main.innerHTML = `<div class="bento">
    <section class="hero w8"><div style="display:grid;gap:14px"><span class="eyebrow">${fecha(new Date())}</span>${heroTxt}</div>
      <div style="justify-self:center;color:var(--hero-ink)">${ult ? rings5(ult.areas.map(x => x.puntaje), 180, ult.global, 'último global') : `<div class="count" style="grid-template-columns:1fr"><div><b>${apl.length}</b><span>simulacros</span></div></div>`}</div></section>
    <div class="card w4"><span class="lbl">Autorización del acudiente</span>${S.perfil.autorizacion_acudiente
      ? `<div class="row" style="gap:12px;flex-wrap:nowrap"><span class="aico" style="background:var(--ok-soft);color:var(--ok)">${ic('i-sync', 22)}</span><div><b>Registrada</b><p class="xs muted">Puede presentar los simulacros.</p></div></div>`
      : `<div class="alert a-warn">${ic('i-warn')}<div><b>Falta la autorización</b>Sin ella no puede presentar simulacros. Pídala a la coordinación de su colegio.</div></div>`}</div>
    <div class="card w7"><div><span class="lbl">Mis simulacros</span><h2>Programados para mi grupo</h2></div><div>${lista}</div></div>
    <div class="card w5"><div class="row between"><div><span class="lbl">Mi último resultado</span><h2>${ult ? esc(ult.simulacro) : 'Aún sin resultados'}</h2></div>${ult ? `<button class="btn sec sm" type="button" data-ir="resultados">Ver</button>` : ''}</div>
      ${ult ? ult.areas.map(x => `<div style="display:grid;grid-template-columns:110px minmax(0,1fr) 34px;gap:10px;align-items:center"><span class="row" style="gap:8px;flex-wrap:nowrap">${aico(x.area, 26)}<b class="small">${SHORT[x.area]}</b></span>${barra(x.puntaje, col(x.area))}<b class="num" style="text-align:right">${x.puntaje}</b></div>`).join('') : '<p class="small muted">Verá su puntaje cuando termine el tiempo de su primer simulacro.</p>'}</div>
  </div>${corp}`;
  main.onclick = e => { const b = e.target.closest('[data-examen]'); if (b) go('examen/' + b.dataset.examen); };
}

// ---------- Simulacro con modo sin conexión ----------
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } },
  del(k) { try { localStorage.removeItem(k); } catch { } },
};
let EX = null, reloj = null, sincro = null;

async function examen({ S, main, params, go }) {
  const apl = params[0];
  clearInterval(reloj); clearInterval(sincro);
  document.body.classList.add('focus');
  main.innerHTML = cargando('Preparando su simulacro…');
  let datos = null;
  try { datos = await rpc('iniciar_intento', { p_aplicacion: apl }); LS.set('f-ex-' + apl, datos); }
  catch (e) {
    const cache = LS.get('f-ex-' + apl, null);
    if (cache && /conexión|fetch|network/i.test(errorMsg(e))) { datos = cache; toast('Sin conexión: se abrió la copia guardada en este equipo.'); }
    else { document.body.classList.remove('focus'); main.innerHTML = `<div class="card" style="max-width:600px;margin:20px auto"><div class="alert a-warn">${ic('i-warn')}<div><b>No se puede abrir el simulacro</b>${esc(errorMsg(e))}</div></div><button class="btn sec" type="button" data-ir="inicio">Volver al inicio</button></div>`; return; }
  }
  const kR = 'f-resp-' + datos.intento, kP = 'f-pend-' + datos.intento, kF = 'f-flag-' + datos.intento, kE = 'f-entrega-' + datos.intento;
  const local = LS.get(kR, {});
  EX = {
    apl, S, go, main, datos, kR, kP, kF, kE,
    resp: { ...(datos.respuestas || {}), ...local },
    pend: LS.get(kP, {}), flags: LS.get(kF, {}),
    i: 0, offset: datos.ahora ? new Date(datos.ahora) - Date.now() : 0,
    fin: new Date(datos.fin).getTime(), online: navigator.onLine, entregado: false, fs: LS.get('f-fs', 0),
  };
  const primeraSinResp = datos.preguntas.findIndex(p => !EX.resp[p.pos]);
  EX.i = Math.max(0, primeraSinResp);
  if (LS.get(kE, false)) { EX.entregado = true; }
  pintarExamen();
  reloj = setInterval(tic, 1000);
  sincro = setInterval(() => sincronizar(false), 30000);
  sincronizar(false);
}
const restante = () => Math.max(0, Math.floor((EX.fin - (Date.now() + EX.offset)) / 1000));
function fmtT(s) { const h = Math.floor(s / 3600), m = String(Math.floor(s % 3600 / 60)).padStart(2, '0'), x = String(s % 60).padStart(2, '0'); return `${h}:${m}:${x}`; }
function tic() {
  if (!EX || !document.body.contains(EX.main)) { clearInterval(reloj); clearInterval(sincro); return; }
  const s = restante(); const el = $('#tm'); if (el) el.textContent = fmtT(s);
  if (s <= 0 && !EX.entregado) { toast('Se terminó el tiempo. Su simulacro se entregó con las respuestas que tenía.'); entregar(true); }
  else if (s === 600) toast('Quedan 10 minutos.');
}
async function sincronizar(entregar) {
  const pend = { ...EX.pend };
  if (!Object.keys(pend).length && !entregar) return true;
  try {
    const r = await rpc('guardar_respuestas', { p_intento: EX.datos.intento, p_resp: entregar ? EX.resp : pend, p_entregar: !!entregar });
    for (const k of Object.keys(pend)) if (EX.pend[k] === pend[k]) delete EX.pend[k];
    LS.set(EX.kP, EX.pend); EX.online = true;
    if (r?.hora) EX.offset = new Date(r.hora) - Date.now();
    if (entregar) { LS.del(EX.kE); }
    estadoSync(); return true;
  } catch (e) { EX.online = false; estadoSync(); return false; }
}
function estadoSync() {
  const el = $('#sync'); if (!el) return;
  const n = Object.keys(EX.pend).length;
  el.outerHTML = syncHTML(n);
}
const syncHTML = n => !EX.online || n ? `<span id="sync" class="sync" style="background:var(--warn-soft);color:var(--warn)">${ic('i-offline', 15)}${EX.online ? 'Guardando…' : 'Sin conexión'}${n ? ` · ${n} por enviar` : ''}</span>` : `<span id="sync" class="sync" style="background:var(--ok-soft);color:var(--ok)">${ic('i-sync', 15)}Todo guardado</span>`;
document.addEventListener('f-online', () => { if (EX && !EX.entregado) sincronizar(false); else if (EX && LS.get(EX.kE, false)) sincronizar(true); });

function pintarExamen() {
  const { datos, main } = EX;
  document.documentElement.style.setProperty('--qsize', (17 + EX.fs * 1.5) + 'px');
  if (EX.entregado) {
    const pendiente = LS.get(EX.kE, false);
    document.body.classList.remove('focus');
    main.innerHTML = `<div class="bento" style="padding-top:8px"><section class="hero w12" style="grid-template-columns:minmax(0,1fr)"><div style="display:grid;gap:12px"><span class="eyebrow">${esc(datos.simulacro)}</span><h1>¡Listo! Su simulacro quedó entregado.</h1>
      <p>Respondió ${Object.keys(EX.resp).length} de ${datos.preguntas.length} preguntas. Verá su puntaje cuando termine el tiempo del simulacro.</p>
      ${pendiente ? `<div class="alert a-warn" style="color:var(--ink)">${ic('i-offline')}<div><b>La entrega se enviará cuando vuelva la señal</b>No cierre esta página ni borre los datos del navegador hasta ver «Todo guardado».</div></div>` : ''}
      <div class="row"><button class="btn glass" type="button" data-ir="inicio">Volver al inicio</button></div></div></section></div>${corp}`;
    return;
  }
  const q = datos.preguntas[EX.i], a = q.area, n = q.pos;
  const answered = Object.keys(EX.resp).length, total = datos.preguntas.length;
  const R = 13, C = 2 * Math.PI * R, left = Math.min(1, restante() / (6 * 3600));
  const ctx = q.contexto ? `<div class="ctx">${esc(q.contexto).replace(/\n/g, '<br>')}</div>` : '';
  const fig = q.figura_url ? `<figure style="margin:0"><img src="${esc(q.figura_url)}" alt="Figura de la pregunta ${n}" style="max-width:100%;border-radius:14px;border:1px solid var(--line);background:#fff"></figure>` : '';
  const opts = Object.entries(q.opciones || {}).map(([k, v]) => `<button type="button" class="opt" role="radio" aria-checked="${EX.resp[n] === k}" data-opt="${k}"><span class="k">${k}</span><span>${esc(v)}</span><span class="kb">tecla ${k}</span></button>`).join('')
    || ['A', 'B', 'C', 'D'].map(k => `<button type="button" class="opt" role="radio" aria-checked="${EX.resp[n] === k}" data-opt="${k}"><span class="k">${k}</span><span class="muted">Opción ${k} (ver la figura)</span><span class="kb">tecla ${k}</span></button>`).join('');
  const bloques = AREAS.map((ar, ai) => {
    const qs = datos.preguntas.filter(p => p.area === ai); if (!qs.length) return '';
    const k = qs.filter(p => EX.resp[p.pos]).length;
    return `<div class="area-block"><span class="ttl"><i style="background:${col(ai)}"></i>${ar}<span class="muted" style="margin-left:auto;font-weight:700">${k}/${qs.length}</span></span><div class="dots">${qs.map(p => { const j = datos.preguntas.indexOf(p); return `<button type="button" class="${EX.resp[p.pos] ? 'ans' : ''} ${EX.flags[p.pos] ? 'flag' : ''} ${j === EX.i ? 'cur' : ''}" data-q="${j}" style="${EX.resp[p.pos] ? `background:${col(ai)}` : ''}" aria-label="Pregunta ${p.pos}">${p.pos}</button>`; }).join('')}</div></div>`;
  }).join('');
  main.innerHTML = `<div class="fbar"><div class="l"><button class="btn sec sm" type="button" data-salirex aria-label="Guardar y salir">${ic('i-exit', 16)}<span class="hide-s">Guardar y salir</span></button><span class="row" style="gap:8px">${aico(a, 34)}<span class="small"><b>${AREAS[a]}</b><br><span class="muted xs hide-s">${esc(datos.simulacro)}</span></span></span></div>
    <div class="row">${syncHTML(Object.keys(EX.pend).length)}<span class="fsz" role="group" aria-label="Tamaño de letra"><button type="button" data-fs="-1" aria-label="Letra más pequeña">A−</button><button type="button" data-fs="1" aria-label="Letra más grande">A+</button></span><span class="timer" aria-label="Tiempo restante"><svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true"><circle cx="17" cy="17" r="${R}" fill="none" stroke="var(--sunk)" stroke-width="4"/><circle cx="17" cy="17" r="${R}" fill="none" stroke="var(--coral)" stroke-width="4" stroke-linecap="round" stroke-dasharray="${C * left} ${C}" transform="rotate(-90 17 17)"/></svg><span id="tm">${fmtT(restante())}</span></span></div></div>
  <div class="exam">
    <div style="display:grid;gap:14px;min-width:0">
      <article class="qcard">
        <div class="qmeta"><div class="row" style="gap:14px"><span class="qnum">${String(n).padStart(3, '0')}</span><div><span class="xs muted">Pregunta ${n} de ${total}</span><br><span class="chip" style="background:${soft(a)};color:${col(a)}"><span class="d" style="background:${col(a)}">${ic(AICON[a], 13)}</span>${esc(q.competencia || SHORT[a])}</span></div></div><button type="button" class="btn ghost sm" data-flag style="color:${EX.flags[n] ? 'var(--coral-ink)' : 'var(--muted)'}">${ic('i-flag', 16)}${EX.flags[n] ? 'Marcada para revisar' : 'Marcar para revisar'}</button></div>
        ${ctx}${fig}<div class="stem"><p>${esc(q.enunciado || '').replace(/\n/g, '<br>')}</p></div>
        <div class="opts" role="radiogroup" aria-label="Opciones">${opts}</div>
      </article>
      <p class="xs muted">Preguntas del ICFES (Evaluar para Avanzar). Puede usar las teclas A, B, C, D y las flechas del teclado.</p>
    </div>
    <aside class="qnav card"><div class="row between"><h3>Mapa del simulacro</h3><span class="xs muted num">${answered} de ${total}</span></div>${bloques}</aside>
  </div>
  <div class="abar"><button class="btn sec" type="button" data-prev ${EX.i === 0 ? 'disabled' : ''}>←<span class="hide-s"> Anterior</span></button><span class="small muted hide-s num" style="padding-inline:8px">${EX.i + 1} / ${total}</span><button class="btn pri" type="button" data-next>${EX.i === total - 1 ? 'Revisar y entregar' : 'Siguiente →'}</button><button class="btn hot" type="button" data-entregar style="font-size:14px;padding:12px 18px">Entregar</button></div>`;
  main.onclick = clickExamen;
}
function responder(k) {
  const q = EX.datos.preguntas[EX.i];
  if (!q || (q.opciones && Object.keys(q.opciones).length && !q.opciones[k])) return;
  EX.resp[q.pos] = k; EX.pend[q.pos] = k;
  LS.set(EX.kR, EX.resp); LS.set(EX.kP, EX.pend);
  pintarExamen(); sincronizar(false);
}
function mover(d) { const j = EX.i + d; if (j >= 0 && j < EX.datos.preguntas.length) { EX.i = j; pintarExamen(); window.scrollTo(0, 0); } }
function clickExamen(e) {
  const b = e.target.closest('button'); if (!b) return;
  const d = b.dataset;
  if (d.opt) return responder(d.opt);
  if (d.q !== undefined) { EX.i = +d.q; pintarExamen(); window.scrollTo(0, 0); return; }
  if ('prev' in d) return mover(-1);
  if ('next' in d) return EX.i === EX.datos.preguntas.length - 1 ? pedirEntrega() : mover(1);
  if ('flag' in d) { const p = EX.datos.preguntas[EX.i].pos; EX.flags[p] = !EX.flags[p]; LS.set(EX.kF, EX.flags); return pintarExamen(); }
  if (d.fs) { EX.fs = Math.max(-2, Math.min(4, EX.fs + +d.fs)); LS.set('f-fs', EX.fs); return pintarExamen(); }
  if ('entregar' in d) return pedirEntrega();
  if ('salirex' in d) { sincronizar(false); clearInterval(reloj); clearInterval(sincro); document.body.classList.remove('focus'); EX.go('inicio'); }
}
document.addEventListener('keydown', e => {
  if (!EX || EX.entregado || !document.body.classList.contains('focus') || $('#modalbox').innerHTML || /INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName)) return;
  const k = e.key.toUpperCase();
  if (/^[A-H]$/.test(k)) responder(k); else if (e.key === 'ArrowRight') mover(1); else if (e.key === 'ArrowLeft') mover(-1);
});
function pedirEntrega() {
  const total = EX.datos.preguntas.length, a = Object.keys(EX.resp).length;
  const porArea = AREAS.map((ar, i) => { const qs = EX.datos.preguntas.filter(p => p.area === i); return qs.length ? `<div class="row" style="gap:10px;flex-wrap:nowrap">${aico(i, 34)}<div><b class="small">${SHORT[i]}</b><div class="xs muted">${qs.filter(p => EX.resp[p.pos]).length} de ${qs.length} respondidas</div></div></div>` : ''; }).join('');
  const marcadas = Object.keys(EX.flags).filter(k => EX.flags[k]).length;
  const w = modal({ icon: 'i-exam', tono: 'coral', titulo: '¿Entregar el simulacro?', sub: 'Después de entregar no podrá cambiar respuestas.',
    cuerpo: `<div class="grid g3" style="gap:10px">${porArea}</div><div class="alert ${a < total ? 'a-warn' : 'a-ok'}">${ic(a < total ? 'i-warn' : 'i-sync')}<div><b>Respondió ${a} de ${total} preguntas</b>${a < total ? 'Aún le quedan preguntas sin responder y todavía tiene tiempo.' : 'Respondió todas las preguntas.'}${marcadas ? ` Tiene ${marcadas} marcadas para revisar.` : ''}</div></div>`,
    pie: `<button class="btn sec" type="button" data-cerrar>Seguir respondiendo</button><button class="btn hot" type="button" id="siEntregar">Sí, entregar</button>` });
  w.querySelector('#siEntregar').onclick = () => { cerrarModal(); entregar(false); };
}
async function entregar(porTiempo) {
  EX.entregado = true; LS.set(EX.kE, true);
  clearInterval(reloj);
  const ok = await sincronizar(true);
  if (ok) { LS.del(EX.kR); LS.del(EX.kP); LS.del(EX.kF); LS.del('f-ex-' + EX.apl); }
  pintarExamen();
}

// ---------- Resultados ----------
async function resultados({ S, main }) {
  main.innerHTML = cargando();
  const res = await rpc('mis_resultados');
  if (!res.length) { main.innerHTML = `${head('Mis resultados', 'Resultados')}<div class="card">${vacio('i-results', 'Todavía no hay resultados', 'Los verá cuando termine el tiempo de su primer simulacro.')}</div>${corp}`; return; }
  let k = 0;
  const pintar = () => {
    const r = res[k], vals = [0, 1, 2, 3, 4].map(i => (r.areas.find(x => x.area === i) || { puntaje: 0 }).puntaje);
    const lugar = r.mitad_inferior
      ? `<div style="display:grid;gap:6px"><b style="font-size:18px">Está en la mitad del grupo que más puede avanzar.</b><p class="small muted">Su área más fuerte fue ${SHORT[vals.indexOf(Math.max(...vals))]}. Para el próximo simulacro, enfóquese en ${SHORT[vals.indexOf(Math.min(...vals))]}.</p></div>`
      : `<div class="row" style="gap:16px;flex-wrap:nowrap"><div class="medal"><div>${r.puesto}.º<small>puesto</small></div></div><div><b style="font-size:18px">Puesto ${r.puesto} de ${r.total}</b><p class="small muted">en su grupo.</p></div></div>`;
    main.innerHTML = `${head(fecha(r.fecha), 'Mis resultados', res.length > 1 ? `<div class="field" style="width:220px"><label for="rsel">Simulacro</label><select id="rsel">${res.map((x, i) => `<option value="${i}" ${i === k ? 'selected' : ''}>${esc(x.simulacro)}</option>`).join('')}</select></div>` : '')}
      <div class="rcard fade"><div class="in"><div style="justify-self:center">${rings5(vals, 220)}</div>
        <div style="display:grid;gap:14px"><span class="lbl">${esc(r.simulacro)} · puntaje global</span><div class="row" style="gap:12px;align-items:flex-end"><span class="big-score">${r.global}</span><span class="muted" style="padding-bottom:8px">de 500</span></div>
        <div class="row">${vals.map((v, i) => `<span class="chip" style="background:${soft(i)};color:${col(i)}"><span class="d" style="background:${col(i)}">${ic(AICON[i], 12)}</span>${SHORT[i]} ${v}</span>`).join('')}</div>
        <p class="xs muted">Se calcula como el ICFES: las cuatro áreas pesan 3 veces e Inglés 1 vez. Promedio de su grupo: ${r.grupo_promedio ?? '—'}.</p></div></div></div>
      <div class="bento"><div class="card w5"><span class="lbl">Mi posición en el grupo</span>${lugar}</div>
        <div class="card w7"><span class="lbl">Por área</span>${vals.map((v, i) => `<div style="display:grid;grid-template-columns:150px minmax(0,1fr) 40px 80px;gap:10px;align-items:center"><span class="row" style="gap:8px;flex-wrap:nowrap">${aico(i, 28)}<b class="small">${AREAS[i]}</b></span>${barra(v, col(i))}<b class="num" style="text-align:right">${v}</b>${lvlTag(i, v)}</div>`).join('')}<p class="xs muted">No se muestran las respuestas correctas ni cuáles acertó.</p></div></div>${corp}`;
    const sel = $('#rsel'); if (sel) sel.onchange = () => { k = +sel.value; pintar(); };
  };
  pintar();
}

async function perfil({ S, main }) {
  const p = S.perfil;
  main.innerHTML = `${head('Mi cuenta', 'Perfil')}<div class="card" style="max-width:560px"><div class="row" style="gap:16px"><span class="av" style="width:64px;height:64px;font-size:20px;border-radius:18px">${esc(iniciales(p.nombres + ' ' + p.apellidos))}</span><div><b style="font-size:19px">${esc(p.nombres)} ${esc(p.apellidos)}</b><br><span class="muted small">Documento ${esc(p.documento || '')}</span>${S.grupo ? `<br><span class="xs muted">Grado ${S.grupo.grado}-${esc(S.grupo.nombre)} · ${esc(S.colegio?.nombre || '')}</span>` : ''}</div></div>
    <div class="row"><button class="btn sec" type="button" data-cambiar-clave>${ic('i-key')}Cambiar contraseña</button><button class="btn ghost" type="button" data-salir>${ic('i-exit')}Cerrar sesión</button></div></div>${corp}`;
}
