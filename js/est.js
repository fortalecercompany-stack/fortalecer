// FORTALECER · pantallas del estudiante
import { $, $$, esc, ic, AREAS, SHORT, AICON, col, soft, aico, chip, toast, errorMsg, modal, cerrarModal, confirmar, head, cargando, vacio, corp, rings5, lvlTag, nivel, nivelNombre, fechaHora, hora, fecha, barra, iniciales, pill } from './lib.js';
import { sb, rpc } from './api.js';
import { avisosHTML } from './avisos.js';
import { notaTxt, notaHTML, notaCls, notaRoja, volverBtn, confeti } from './lib.js';
import { prueba, revision } from './prueba.js';

export async function render(ctx) {
  const { seccion } = ctx;
  if (seccion === 'examen') return examen(ctx);
  if (seccion === 'prueba') return prueba(ctx);
  if (seccion === 'revision') return revision(ctx);
  if (seccion === 'resultados') return resultados(ctx);
  if (seccion === 'notas') return notas(ctx);
  if (seccion === 'refuerzo') return refuerzo(ctx);
  if (seccion === 'honor') return honor(ctx);
  if (seccion === 'perfil') return perfil(ctx);
  return inicio(ctx);
}

const ESTADO = { proxima: ['Próximo', 'p-info'], abierta: ['Abierto', 'p-ok'], entregado: ['Entregado', 'p-brand'], cerrada: ['Terminado', 'p-mute'] };
const escalaDe = S => ({ min: S.colegio?.escala_min ?? 1, max: S.colegio?.escala_max ?? 5, aprobar: S.colegio?.nota_aprobar ?? 3, decimales: S.colegio?.decimales ?? 1 });
const cuenta = ms => { const m = Math.max(0, Math.round(ms / 60000)); if (m < 60) return [m, m === 1 ? 'minuto' : 'minutos']; const h = Math.round(m / 60); if (h < 48) return [h, h === 1 ? 'hora' : 'horas']; const d = Math.round(h / 24); return [d, 'días']; };

async function inicio({ S, main, go }) {
  main.innerHTML = cargando();
  const [apl, exs, res, N, plan, avHTML] = await Promise.all([rpc('mis_aplicaciones'), rpc('mis_examenes_doc').catch(() => []), rpc('mis_resultados').catch(() => []), rpc('mis_notas', {}).catch(() => null), rpc('mi_plan').catch(() => null), avisosHTML({ S })]);
  const es = N?.escala || escalaDe(S), d = es.decimales;
  const ahora = Date.now();
  // Lo pendiente: exámenes de docentes y simulacros abiertos o próximos, ordenados por cuándo cierran
  const pend = [
    ...exs.filter(e => e.estado === 'abierto' || e.estado === 'proximo').map(e => ({ tipo: e.taller ? 'taller' : 'examen', id: e.id, titulo: e.titulo, sub: `${esc(e.materia || 'Examen')} · ${esc(e.docente)}`, abierto: e.estado === 'abierto', curso: e.en_curso, cuando: e.estado === 'abierto' ? new Date(e.fin) : new Date(e.apertura), usados: e.usados, intentos: e.intentos })),
    ...apl.filter(a => a.estado === 'abierta' || a.estado === 'proxima').map(a => ({ tipo: 'simulacro', id: a.id, titulo: a.nombre, sub: 'Simulacro ICFES · 125 preguntas', abierto: a.estado === 'abierta', curso: a.respondidas > 0, cuando: a.estado === 'abierta' ? new Date(a.fin) : new Date(a.inicio) })),
  ].sort((x, y) => (y.abierto - x.abierto) || (x.cuando - y.cuando));
  const urgente = pend.find(p => p.abierto);
  const nombre = esc(S.perfil.nombres.split(' ')[0]);
  const ult = res[0], ant = res[1];
  const pendHTML = pend.length ? pend.slice(0, 6).map(p => { const [n, u] = cuenta(p.cuando - ahora);
    const btn = p.abierto ? (p.tipo === 'simulacro' ? (S.perfil.autorizacion_acudiente ? `<button class="btn hot sm" type="button" data-examen="${p.id}">${p.curso ? 'Continuar' : 'Empezar'}</button>` : pill('Falta autorización', 'p-warn')) : `<button class="btn hot sm" type="button" data-prueba="${p.id}">${p.curso ? 'Continuar' : p.usados ? 'Otro intento' : 'Empezar'}</button>`) : pill('Próximo', 'p-info');
    return `<div class="pend ${p.abierto ? 'hot' : ''}"><div class="cnt"><b>${n}</b><span>${u} ${p.abierto ? 'para cerrar' : 'para abrir'}</span></div><div class="tx"><b>${esc(p.titulo)}</b><span class="xs muted">${p.sub} · ${p.abierto ? 'cierra' : 'abre'} ${fechaHora(p.cuando)}</span></div>${btn}</div>`; }).join('')
    : `<p class="small muted">No tiene nada pendiente. Aproveche para practicar en su plan de refuerzo.</p>`;
  const mats = (N?.materias || []);
  const notasHTML = mats.length ? `<div class="mnotas">${mats.map(m => `<span><b>${esc(m.materia)}</b><br><span class="xs muted">${esc(m.docente || '')}</span></span>${notaHTML(m.nota, es)}`).join('')}</div>` : `<p class="small muted">Aún no tiene notas en este período.</p>`;
  const sub = urgente ? `${urgente.tipo === 'simulacro' ? 'El' : 'El examen'} <b>${esc(urgente.titulo)}</b> está abierto. ${urgente.tipo === 'simulacro' && !S.perfil.autorizacion_acudiente ? 'Falta la autorización de su acudiente.' : ''}` : pend.length ? `Lo próximo: <b>${esc(pend[0].titulo)}</b>, el ${fecha(pend[0].cuando)}.` : 'Por ahora no tiene exámenes ni simulacros abiertos.';
  const accion = urgente ? (urgente.tipo === 'simulacro' ? (S.perfil.autorizacion_acudiente ? `<button class="btn pri" type="button" data-examen="${urgente.id}">${ic('i-play', 18)}${urgente.curso ? 'Continuar' : 'Empezar'} simulacro</button>` : '') : `<button class="btn pri" type="button" data-prueba="${urgente.id}">${ic('i-play', 18)}${urgente.curso ? 'Continuar' : 'Empezar'} examen</button>`) : `<button class="btn pri" type="button" data-ir="refuerzo">${ic('i-up', 18)}Practicar</button>`;
  main.innerHTML = `${head(fecha(new Date()), `Hola, ${nombre}.`, accion, { sub })}
    <div class="grid g3">
      <div class="card tile2"><span class="lbl">Puntaje ICFES</span><span class="v">${ult ? `<span data-contar="${ult.global}">${ult.global}</span><span class="muted" style="font-size:18px"> / 500</span>` : '—'}</span><span class="xs muted">${ult ? `${esc(ult.simulacro)}${ant ? ` · ${ult.global >= ant.global ? 'subió' : 'bajó'} ${Math.abs(ult.global - ant.global)}` : ''}` : 'Aún sin simulacros terminados'}</span></div>
      <div class="card tile2" style="--tc:var(--coral)"><span class="lbl">Mi puesto</span><span class="v">${ult ? `${ult.puesto}.º<span class="muted" style="font-size:18px"> de ${ult.total}</span>` : '—'}</span><span class="xs muted">${ult ? `En el grupo · ${ult.puesto_colegio}.º de ${ult.total_colegio} en el colegio` : 'Se ve después del primer simulacro'}</span></div>
      <div class="card tile2" style="--tc:var(--warn)"><span class="lbl">Racha de práctica</span><span class="v">${plan?.racha || 0}<span class="muted" style="font-size:18px"> ${plan?.racha === 1 ? 'día' : 'días'}</span></span><span class="xs muted">${plan?.hoy?.total ? `Hoy respondió ${plan.hoy.total} preguntas` : 'Practique hoy para no perderla'}</span></div>
    </div>
    <div class="bento">
      <div class="card w7"><div><span class="lbl">Pendientes</span><h2>Lo que tengo por hacer</h2></div><div style="display:grid;gap:10px">${pendHTML}</div></div>
      <div class="card w5"><div class="row between"><div><span class="lbl">${N?.periodo ? esc(N.periodo.nombre) : 'Período'}</span><h2>Mis notas</h2></div><button class="btn sec sm" type="button" data-ir="notas">Ver todo</button></div>${notasHTML}</div>
      ${ult ? `<div class="card w12"><div class="row between"><div><span class="lbl">Último simulacro</span><h2>${esc(ult.simulacro)}</h2></div><button class="btn sec sm" type="button" data-ir="resultados">Ver resultados</button></div>${[0, 1, 2, 3, 4].map(i => { const x = ult.areas.find(z => z.area === i) || { puntaje: 0 }; return `<div style="display:grid;grid-template-columns:130px minmax(0,1fr) 34px;gap:10px;align-items:center"><span class="row" style="gap:8px;flex-wrap:nowrap">${aico(i, 26)}<b class="small">${SHORT[i]}</b></span>${barra(x.puntaje, col(i))}<b class="num" style="text-align:right">${x.puntaje}</b></div>`; }).join('')}</div>` : ''}
      ${!S.perfil.autorizacion_acudiente ? `<div class="card w12"><div class="alert a-warn">${ic('i-warn')}<div><b>Falta la autorización de su acudiente</b>Sin ella no puede presentar los simulacros ICFES. Los exámenes de sus docentes sí los puede presentar.</div></div></div>` : ''}
      ${avHTML}
    </div>${corp}`;
  main.onclick = e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.examen) go('examen/' + b.dataset.examen); if (b.dataset.prueba) go('prueba/' + b.dataset.prueba); };
}

// ---------- Mis notas ----------
async function notas({ S, main, params, go }) {
  main.innerHTML = cargando();
  const [N, exs] = await Promise.all([rpc('mis_notas', params[0] ? { p_periodo: params[0] } : {}), rpc('mis_examenes_doc').catch(() => [])]);
  const es = N.escala, d = es.decimales;
  const vals = N.materias.filter(m => m.nota != null).map(m => +m.nota), prom = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  const ex = Object.fromEntries(exs.map(e => [e.id, e]));
  main.innerHTML = `${head(N.periodo ? `${esc(N.periodo.nombre)} ${N.periodo.anio}` : 'Todo el año', 'Mis notas', N.periodos.length > 1 ? `<div class="field"><label for="per">Período</label><select id="per">${N.periodos.map(p => `<option value="${p.id}" ${p.id === N.periodo?.id ? 'selected' : ''}>${esc(p.nombre)} ${p.anio}</option>`).join('')}</select></div>` : '',
      { sub: prom == null ? 'Aún no tiene notas en este período.' : `Promedio general: <b>${notaTxt(prom, d)}</b>. Se aprueba con ${notaTxt(es.aprobar, d)}.` })}
    ${N.materias.length ? `<div class="grid g2">${N.materias.map((m, i) => `<div class="card tile2" style="--tc:var(--a${i % 5 + 1})"><div class="row between"><div><span class="lbl">${esc(m.docente || '')}</span><h3>${esc(m.materia)}</h3></div><span class="v" style="color:var(--${m.nota == null ? 'muted' : notaCls(m.nota, es)})">${notaTxt(m.nota, d)}</span></div>
        <div style="display:grid;gap:6px">${(m.examenes || []).map(x => { const e = ex[x.id]; return `<div class="row between" style="padding:8px 10px;border-radius:12px;background:var(--surface-2)"><span class="small"><b>${esc(x.titulo)}</b><br><span class="xs muted">${new Date(x.fin) > Date.now() ? 'Abierto hasta ' + fechaHora(x.fin) : 'Cerró ' + fecha(x.fin)}</span></span><span class="row" style="gap:8px">${notaHTML(x.nota, es)}${e?.revision && e.ultimo ? `<button class="btn ghost sm" type="button" data-rev="${e.ultimo}">Revisar</button>` : ''}</span></div>`; }).join('')}</div></div>`).join('')}</div>`
      : `<div class="card">${vacio('i-list', 'Aún no hay notas', 'Cuando sus docentes programen exámenes, verá aquí sus notas por materia.')}</div>`}
    <p class="xs muted">Si un examen ya cerró y no lo presentó, cuenta con la nota mínima (${notaTxt(es.min, d)}). Los talleres de práctica no cuentan.</p>${corp}`;
  main.onchange = e => { if (e.target.id === 'per') go('notas/' + e.target.value); };
  main.onclick = e => { const r = e.target.closest('[data-rev]'); if (r) go('revision/' + r.dataset.rev); };
}

// ---------- Plan de refuerzo y práctica ----------
let PR = null;
async function refuerzo({ S, main, go }) {
  main.innerHTML = cargando();
  const plan = await rpc('mi_plan');
  const debiles = plan.competencias.slice(0, 3);
  const disp = plan.disponibles || {};
  main.innerHTML = `${head('Plan de refuerzo', 'A practicar', '', { sub: `Racha: <b>${plan.racha} ${plan.racha === 1 ? 'día' : 'días'}</b> seguidos practicando.${plan.hoy?.total ? ` Hoy lleva ${plan.hoy.aciertos} de ${plan.hoy.total}.` : ''}` })}
    <div class="grid g3">${debiles.length ? debiles.map(c => `<div class="card tile2" style="--tc:${col(c.area)}"><span class="row" style="gap:8px">${aico(c.area, 30)}<span class="lbl">${SHORT[c.area]}</span></span><b style="font-size:17px">${esc(c.competencia)}</b><span class="small muted">Acertó ${c.aciertos} de ${c.total} (${c.pct}%) en los simulacros.</span><button class="btn pri sm" type="button" data-prac="${c.area}" data-comp="${esc(c.competencia)}" ${disp[c.area] ? '' : 'disabled'}>${disp[c.area] ? 'Practicar 5 preguntas' : 'Sin preguntas disponibles'}</button></div>`).join('')
      : `<div class="card w12" style="grid-column:1/-1">${vacio('i-up', 'Su plan aparece después del primer simulacro', 'Mientras tanto, practique el área que quiera.')}</div>`}</div>
    <div class="card"><div><span class="lbl">Práctica libre</span><h2>Elija un área</h2></div><div class="grid g5" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">${AREAS.map((a, i) => `<button class="card tile2" type="button" data-prac="${i}" style="--tc:${col(i)};cursor:pointer;font:inherit;color:inherit;text-align:left" ${disp[i] ? '' : 'disabled'}>${aico(i, 34)}<b>${a}</b><span class="xs muted">${disp[i] ? 'Practicar' : 'Sin preguntas'}</span></button>`).join('')}</div>
      <p class="xs muted">Son preguntas del ICFES que no salen en ningún simulacro. Al responder verá enseguida si acertó y por qué.</p></div>
    ${plan.talleres.length ? `<div class="card"><div><span class="lbl">De sus docentes</span><h2>Talleres abiertos</h2></div><div style="display:grid;gap:10px">${plan.talleres.map(t => `<div class="pend"><div class="tx"><b>${esc(t.titulo)}</b><span class="xs muted">${esc(t.materia || '')} · hasta ${fechaHora(t.fin)}</span></div><button class="btn sec sm" type="button" data-prueba="${t.id}">Abrir</button></div>`).join('')}</div></div>` : ''}${corp}`;
  main.onclick = async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.prueba) return go('prueba/' + b.dataset.prueba);
    if (b.dataset.prac != null) {
      main.innerHTML = cargando('Buscando preguntas…');
      try { const qs = await rpc('mi_practica', { p_area: +b.dataset.prac, p_competencia: b.dataset.comp || null }); if (!qs.length) { toast('No hay más preguntas en esta área por ahora.', 'error'); return refuerzo({ S, main, go }); } PR = { qs, i: 0, r: {}, ok: 0, main, S, go }; practicar(); }
      catch (er) { toast(errorMsg(er), 'error'); refuerzo({ S, main, go }); }
    }
  };
}
function practicar() {
  const { qs, i, r, main } = PR, q = qs[i], a = q.area, res = r[i];
  if (i >= qs.length) return finPractica();
  const opts = Object.entries(q.opciones || {}).map(([k, v]) => { const cls = res ? (k === q.respuesta ? 'right' : k === res ? 'wrong' : '') : ''; return `<button type="button" class="opt ${cls}" data-o="${k}" ${res ? 'disabled' : ''} aria-checked="${res === k}"><span class="k">${k}</span><span>${esc(v)}</span></button>`; }).join('');
  main.innerHTML = `${head(`${SHORT[a]} · pregunta ${i + 1} de ${qs.length}`, 'Práctica', `<button class="btn sec" type="button" data-ir="refuerzo">Salir</button>`)}
    <article class="qcard practq">${q.contexto ? `<div class="ctx">${esc(q.contexto).replace(/\n/g, '<br>')}</div>` : ''}${q.figura_url ? `<img src="${esc(q.figura_url)}" alt="Figura" style="max-width:100%;border-radius:14px;background:#fff">` : ''}<div class="stem"><p>${esc(q.enunciado || '').replace(/\n/g, '<br>')}</p></div><div class="opts">${opts}</div>
      ${res ? `<div class="alert ${res === q.respuesta ? 'a-ok' : 'a-warn'}">${ic(res === q.respuesta ? 'i-sync' : 'i-info')}<div><b>${res === q.respuesta ? '¡Correcto!' : `La correcta era la ${q.respuesta}`}</b>${esc(q.justificacion || '')}</div></div><button class="btn pri" type="button" data-sig style="justify-self:start">${i === qs.length - 1 ? 'Ver cómo me fue' : 'Siguiente →'}</button>` : ''}</article>${corp}`;
  main.onclick = e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.o && !res) { r[i] = b.dataset.o; if (b.dataset.o === q.respuesta) PR.ok++; practicar(); } if ('sig' in b.dataset) { PR.i++; practicar(); } };
}
async function finPractica() {
  const { ok, qs, main, go } = PR;
  let racha = 0; try { racha = await rpc('registrar_practica', { p_aciertos: ok, p_total: qs.length }); } catch { }
  main.innerHTML = `<section class="band"><i class="blob b1"></i><i class="blob b2"></i>${ok >= Math.ceil(qs.length * .6) ? confeti() : ''}<div class="band-in"><div class="t"><span class="chipe">Práctica terminada</span><h1>${ok} de ${qs.length} correctas</h1><p>Racha: <b>${racha} ${racha === 1 ? 'día' : 'días'}</b> seguidos practicando. Vuelva mañana para mantenerla.</p><div class="acts"><button class="btn pri" type="button" data-ir="refuerzo">Seguir practicando</button><button class="btn sec" type="button" data-ir="inicio">Inicio</button></div></div><div class="hoja-nota" style="display:grid;place-items:center;gap:4px"><span style="color:#E0562F">${ic('i-fire', 54)}</span><b style="font:700 40px var(--display);color:#141833">${racha}</b><small style="color:#5C6283;font-weight:700">${racha === 1 ? 'día' : 'días'}</small></div></div></section>${corp}`;
  main.onclick = null;
}

// ---------- Cuadro de honor ----------
async function honor({ S, main }) {
  main.innerHTML = cargando();
  const H = await rpc('cuadro_honor');
  const grados = [...new Set(H.map(x => x.grado))];
  const yo = `${S.perfil.nombres} ${S.perfil.apellidos}`;
  main.innerHTML = `${head('Los 10 mejores de cada grado', 'Cuadro de honor', '', { volver: volverBtn('resultados', 'Resultados ICFES'), sub: 'Según el puntaje global del último simulacro de cada grado.' })}
    ${grados.length ? `<div class="grid g3">${grados.map(g => { const L = H.filter(x => x.grado === g); return `<div class="card"><div><span class="lbl">${esc(L[0].simulacro)}</span><h2>Grado ${g}.°</h2></div><ol class="honor">${L.map(x => `<li class="${x.nombre === yo ? 'yo' : ''}"><span class="pos">${x.puesto}</span><span><b class="small">${esc(x.nombre)}</b><br><span class="xs muted">Grupo ${esc(x.grupo)}</span></span><b class="num">${x.global}</b></li>`).join('')}</ol></div>`; }).join('')}</div>`
      : `<div class="card">${vacio('i-trophy', 'Aún no hay cuadro de honor', 'Aparece cuando termine el primer simulacro.')}</div>`}${corp}`;
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
  const kR = 'f-resp-' + datos.intento, kP = 'f-pend-' + datos.intento, kF = 'f-flag-' + datos.intento, kE = 'f-entrega-' + datos.intento, kI = 'f-inc-' + datos.intento, kA = 'f-adv-' + datos.intento;
  const local = LS.get(kR, {});
  EX = {
    apl, S, go, main, datos, kR, kP, kF, kE, kI, kA, cola: LS.get(kI, []), adv: Math.max(datos.advertencias || 0, LS.get(kA, 0)), vig: false, fsActivo: false, ultimoInc: 0, offDesde: navigator.onLine ? 0 : Date.now(),
    resp: { ...(datos.respuestas || {}), ...local },
    pend: LS.get(kP, {}), flags: LS.get(kF, {}),
    i: 0, offset: datos.ahora ? new Date(datos.ahora) - Date.now() : 0,
    fin: new Date(datos.fin).getTime(), online: navigator.onLine, entregado: false, fs: LS.get('f-fs', 0),
  };
  const primeraSinResp = datos.preguntas.findIndex(p => !EX.resp[p.pos]);
  EX.i = Math.max(0, primeraSinResp);
  if (LS.get(kE, false)) { EX.entregado = true; }
  if (EX.entregado) pintarExamen(); else pintarReglas(datos.reingresos > 0 || Object.keys(EX.resp).length > 0);
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
// ---------- Seguridad del simulacro ----------
// Incidentes que cuentan como advertencia: salir de la ventana, salir de pantalla completa,
// captura de pantalla, copiar e imprimir. A la segunda advertencia el simulacro se cierra.
const LIMITE_ADV = 2;
const vigilando = () => EX && EX.vig && !EX.entregado && document.body.classList.contains('focus');
function incidente(tipo, detalle = null, cuenta = true) {
  if (!EX || EX.entregado) return;
  if (cuenta) {
    if (!vigilando()) return;
    const t = Date.now(); if (t - EX.ultimoInc < 2500) return; // un mismo gesto dispara varios eventos
    EX.ultimoInc = t;
    EX.adv++; LS.set(EX.kA, EX.adv);
  }
  EX.cola.push({ p_intento: EX.datos.intento, p_tipo: tipo, p_detalle: detalle, p_cuenta: cuenta }); LS.set(EX.kI, EX.cola);
  if (!cuenta) { sincronizar(false); return; }
  if (EX.adv >= LIMITE_ADV) return cerrarPorSospecha(tipo);
  mostrarAdvertencia(tipo);
  sincronizar(false);
}
const TXT_INC = { salida: 'Salió de la ventana del simulacro', pantalla_completa: 'Salió de la pantalla completa', captura: 'Intentó tomar una captura de pantalla', copiar: 'Intentó copiar el contenido', imprimir: 'Intentó imprimir' };
function mostrarAdvertencia(tipo) {
  const v = document.createElement('div'); v.className = 'fraude'; v.setAttribute('role', 'alertdialog'); v.setAttribute('aria-modal', 'true');
  v.innerHTML = `<div class="fraude-in"><span class="fraude-ico">${ic('i-warn', 34)}</span><span class="eyebrow" style="color:var(--bad)">Primera y única advertencia</span>
    <h2>${TXT_INC[tipo] || 'Acción no permitida'}</h2>
    <p>Esta acción quedó registrada y la coordinación puede verla. <b>Si vuelve a salir de esta ventana, tomar una captura, copiar o imprimir, el simulacro se cerrará automáticamente y se reportará como sospecha de fraude.</b></p>
    <button class="btn hot" type="button" id="volverEx">Entiendo, volver al simulacro</button></div>`;
  document.body.appendChild(v);
  v.querySelector('#volverEx').onclick = () => { v.remove(); pedirPantallaCompleta(); };
}
async function cerrarPorSospecha(tipo) {
  EX.sospecha = true; EX.motivo = TXT_INC[tipo] || 'Acción no permitida';
  document.querySelectorAll('.fraude').forEach(x => x.remove());
  EX.entregado = true; LS.set(EX.kE, true);
  clearInterval(reloj);
  salirPantallaCompleta();
  const ok = await sincronizar(true);
  if (ok) { LS.del(EX.kR); LS.del(EX.kP); LS.del(EX.kF); LS.del('f-ex-' + EX.apl); }
  pintarExamen();
}
function pedirPantallaCompleta() {
  const el = document.documentElement;
  if (!el.requestFullscreen || document.fullscreenElement) { EX.fsActivo = !!document.fullscreenElement; return; }
  el.requestFullscreen({ navigationUI: 'hide' }).then(() => { EX.fsActivo = true; }).catch(() => { EX.fsActivo = false; });
}
function salirPantallaCompleta() { try { if (document.fullscreenElement) document.exitFullscreen(); } catch { } EX && (EX.fsActivo = false); }
function pintarReglas(reingreso) {
  const { datos, main } = EX;
  main.innerHTML = `<div class="reglas card"><div class="row" style="gap:14px;flex-wrap:nowrap"><span class="aico" style="width:56px;height:56px;background:var(--brand-soft);color:var(--brand)">${ic('i-key', 28)}</span><div><span class="lbl">${esc(datos.simulacro)}</span><h2>${reingreso ? 'Está volviendo a entrar al simulacro' : 'Reglas del simulacro'}</h2></div></div>
    ${reingreso ? `<div class="alert a-warn">${ic('i-warn')}<div><b>Este reingreso quedó registrado.</b>Sus respuestas anteriores se conservan. Las reglas siguen vigentes${EX.adv ? ` y ya tiene ${EX.adv} advertencia` : ''}.</div></div>` : ''}
    <ol class="reglas-lista">
      <li><b>Trabaje en esta ventana, en pantalla completa.</b> No abra otras pestañas, programas ni aplicaciones.</li>
      <li><b>No tome capturas de pantalla, no copie ni imprima</b> las preguntas.</li>
      <li><b>No use celular, inteligencia artificial ni ayuda de otras personas.</b> Las preguntas llevan su nombre y documento como marca de agua.</li>
      <li>La primera vez que incumpla una regla recibirá una <b>advertencia</b>. La segunda vez, <b>el simulacro se cerrará solo</b> y se informará a la coordinación como <b>sospecha de fraude</b>.</li>
      <li>Si se va la luz o el internet, el sistema lo detecta y guarda sus respuestas en este equipo. Cuando vuelva la conexión, se envían solas.</li>
    </ol>
    <div class="row"><button class="btn hot" type="button" id="aceptoReglas">${ic('i-exam')}${reingreso ? 'Continuar en pantalla completa' : 'Acepto las reglas. Empezar'}</button><button class="btn ghost" type="button" data-ir="inicio">Ahora no</button></div>
    <p class="xs muted">Al empezar, la pantalla se pondrá completa. Tiempo disponible: hasta las ${hora(new Date(EX.fin))}.</p></div>`;
  $('#aceptoReglas').onclick = () => { pedirPantallaCompleta(); EX.vig = true; document.body.classList.add('focus'); pintarExamen(); };
  document.body.classList.remove('focus');
}
// Eventos que vigilan el simulacro
window.addEventListener('blur', () => { if (vigilando() && !$('.fraude')) setTimeout(() => { if (!document.hasFocus()) incidente('salida'); }, 300); });
document.addEventListener('visibilitychange', () => { if (document.hidden) incidente('salida'); });
document.addEventListener('fullscreenchange', () => { if (EX && EX.fsActivo && !document.fullscreenElement) { EX.fsActivo = false; if (vigilando()) incidente('pantalla_completa'); } });
window.addEventListener('beforeprint', () => incidente('imprimir'));
['copy', 'cut'].forEach(ev => document.addEventListener(ev, e => { if (!vigilando()) return; e.preventDefault(); incidente('copiar'); }, true));
['contextmenu', 'dragstart', 'paste'].forEach(ev => document.addEventListener(ev, e => { if (vigilando()) e.preventDefault(); }, true));
document.addEventListener('keydown', e => {
  if (!vigilando()) return;
  const k = (e.key || '').toLowerCase(), mod = e.ctrlKey || e.metaKey;
  if (k === 'printscreen') { e.preventDefault(); return incidente('captura'); }
  if (mod && (k === 'c' || k === 'x')) { e.preventDefault(); return incidente('copiar'); }
  if (mod && k === 'p') { e.preventDefault(); return incidente('imprimir'); }
  if ((mod && ['s', 'u', 'a'].includes(k)) || k === 'f12' || (mod && e.shiftKey && ['i', 'j', 'c', 's'].includes(k))) { e.preventDefault(); }
}, true);
document.addEventListener('keyup', e => { if ((e.key || '').toLowerCase() === 'printscreen') incidente('captura'); }, true);
// Conexión: el sistema la detecta solo
window.addEventListener('offline', () => { if (!EX || EX.entregado) return; EX.offDesde = Date.now(); EX.online = false; estadoSync(); toast('Se perdió la conexión. Siga respondiendo: sus respuestas se guardan en este equipo y se enviarán solas.', 'error'); });
window.addEventListener('online', () => { if (!EX || !EX.offDesde) return; const min = Math.max(1, Math.round((Date.now() - EX.offDesde) / 60000)); EX.offDesde = 0; incidente('desconexion', `${min} min`, false); });

async function enviarIncidentes() {
  while (EX.cola.length) {
    const r = await rpc('registrar_incidente', EX.cola[0]);
    EX.cola.shift(); LS.set(EX.kI, EX.cola);
    if (r) { EX.adv = Math.max(EX.adv, r.advertencias || 0); LS.set(EX.kA, EX.adv); if (r.cerrado) { EX.cerradoServidor = true; if (r.sospecha) EX.sospecha = true; } }
  }
}
async function sincronizar(entregarAhora) {
  const pend = { ...EX.pend };
  if (!Object.keys(pend).length && !entregarAhora && !EX.cola.length) return true;
  try {
    if (Object.keys(pend).length || entregarAhora) {
      const r = await rpc('guardar_respuestas', { p_intento: EX.datos.intento, p_resp: entregarAhora ? EX.resp : pend, p_entregar: false });
      for (const k of Object.keys(pend)) if (EX.pend[k] === pend[k]) delete EX.pend[k];
      LS.set(EX.kP, EX.pend);
      if (r?.hora) EX.offset = new Date(r.hora) - Date.now();
    }
    await enviarIncidentes();
    if (entregarAhora && !EX.cerradoServidor) await rpc('guardar_respuestas', { p_intento: EX.datos.intento, p_resp: {}, p_entregar: true });
    if (entregarAhora) { LS.del(EX.kE); LS.del(EX.kI); LS.del(EX.kA); }
    EX.online = true;
    if (EX.cerradoServidor && !EX.entregado) { EX.entregado = true; clearInterval(reloj); salirPantallaCompleta(); pintarExamen(); }
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
    if (EX.sospecha) {
      main.innerHTML = `<div class="card" style="max-width:640px;margin:20px auto;text-align:center;place-items:center;gap:14px"><span class="aico" style="width:72px;height:72px;background:var(--bad-soft);color:var(--bad)">${ic('i-warn', 34)}</span><h2>Su simulacro fue cerrado</h2>
        <p>${esc(EX.motivo || 'Se incumplieron las reglas')} después de una advertencia. Sus respuestas quedaron guardadas y el caso se informó a la coordinación como <b>sospecha de fraude</b>.</p>
        <p class="small muted">Si fue un error, hable con su coordinador: solo él puede habilitarlo de nuevo.</p>
        ${pendiente ? `<div class="alert a-warn">${ic('i-offline')}<div><b>Falta enviar la información</b>No cierre esta página hasta que vuelva la conexión.</div></div>` : ''}
        <button class="btn sec" type="button" data-ir="inicio">Volver al inicio</button></div>${corp}`;
      return;
    }
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
  main.innerHTML = `<div class="fbar"><div class="l"><span class="row" style="gap:8px">${aico(a, 34)}<span class="small"><b>${AREAS[a]}</b><br><span class="muted xs hide-s">${esc(datos.simulacro)}</span></span></span></div>
    <div class="row">${syncHTML(Object.keys(EX.pend).length)}<span class="fsz" role="group" aria-label="Tamaño de letra"><button type="button" data-fs="-1" aria-label="Letra más pequeña">A−</button><button type="button" data-fs="1" aria-label="Letra más grande">A+</button></span><span class="timer" aria-label="Tiempo restante"><svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true"><circle cx="17" cy="17" r="${R}" fill="none" stroke="var(--sunk)" stroke-width="4"/><circle cx="17" cy="17" r="${R}" fill="none" stroke="var(--coral)" stroke-width="4" stroke-linecap="round" stroke-dasharray="${C * left} ${C}" transform="rotate(-90 17 17)"/></svg><span id="tm">${fmtT(restante())}</span></span></div></div>
  <div class="exam">
    <div style="display:grid;gap:14px;min-width:0">
      <article class="qcard">
        <div class="qmeta"><div class="row" style="gap:14px"><span class="qnum">${String(n).padStart(3, '0')}</span><div><span class="xs muted">Pregunta ${n} de ${total}</span><br><span class="chip" style="background:${soft(a)};color:${col(a)}"><span class="d" style="background:${col(a)}">${ic(AICON[a], 13)}</span>${esc(q.competencia || SHORT[a])}</span></div></div><button type="button" class="btn ghost sm" data-flag style="color:${EX.flags[n] ? 'var(--coral-ink)' : 'var(--muted)'}">${ic('i-flag', 16)}${EX.flags[n] ? 'Marcada para revisar' : 'Marcar para revisar'}</button></div>
        ${ctx}${fig}<div class="stem"><p>${esc(q.enunciado || '').replace(/\n/g, '<br>')}</p></div>
        <div class="opts" role="radiogroup" aria-label="Opciones">${opts}</div>
      </article>
      <p class="xs muted">Preguntas del ICFES (Evaluar para Avanzar). Puede usar las teclas A, B, C, D y las flechas del teclado. No salga de esta ventana: cada salida queda registrada.</p>
    </div>
    <aside class="qnav card"><div class="row between"><h3>Mapa del simulacro</h3><span class="xs muted num">${answered} de ${total}</span></div>${bloques}</aside>
  </div>
  <div class="abar"><button class="btn sec" type="button" data-prev ${EX.i === 0 ? 'disabled' : ''}>←<span class="hide-s"> Anterior</span></button><span class="small muted hide-s num" style="padding-inline:8px">${EX.i + 1} / ${total}</span><button class="btn pri" type="button" data-next>${EX.i === total - 1 ? 'Revisar y entregar' : 'Siguiente →'}</button><button class="btn hot" type="button" data-entregar style="font-size:14px;padding:12px 18px">Entregar</button></div>`;
  main.insertAdjacentHTML('beforeend', marcaDeAgua());
  main.onclick = clickExamen;
}
function marcaDeAgua() {
  const p = EX.S.perfil, txt = `${p.nombres} ${p.apellidos} · ${p.documento || ''} · FORTALECER`.replace(/[<>&"]/g, '');
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='420' height='220'><text x='10' y='120' transform='rotate(-24 210 110)' font-family='sans-serif' font-size='15' font-weight='700' fill='%23808080'>${encodeURIComponent(txt)}</text></svg>`;
  return `<div class="marca-agua" aria-hidden="true" style="background-image:url(&quot;data:image/svg+xml;utf8,${svg}&quot;)"></div>`;
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
}
document.addEventListener('keydown', e => {
  if (!EX || EX.entregado || !EX.vig || $('.fraude') || !document.body.classList.contains('focus') || $('#modalbox').innerHTML || /INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName)) return;
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
  clearInterval(reloj); salirPantallaCompleta();
  const ok = await sincronizar(true);
  if (ok) { LS.del(EX.kR); LS.del(EX.kP); LS.del(EX.kF); LS.del('f-ex-' + EX.apl); }
  pintarExamen();
}

// ---------- Resultados ICFES: puntaje, puesto, evolución y medallas ----------
function medallas(res, racha) {
  const ult = res[0];
  const sube = res.length > 1 && res[0].global - res[1].global >= 20;
  const nivel4 = ult && ult.areas.some(x => nivel(x.area, x.puntaje) === 4);
  const L = [
    ['i-star', 'Primer simulacro', 'Presentó su primer simulacro', res.length >= 1, 'var(--a1)'],
    ['i-up', 'En ascenso', 'Subió 20 puntos o más', sube, 'var(--a3)'],
    ['i-trophy', 'Podio', 'Entre los 3 mejores del grupo', ult && ult.puesto <= 3, '#D9A13A'],
    ['i-medal', 'Nivel 4', 'Nivel 4 en al menos un área', nivel4, 'var(--a4)'],
    ['i-results', '300 o más', 'Puntaje global de 300 o más', ult && ult.global >= 300, 'var(--a2)'],
    ['i-fire', 'Constante', '5 días seguidos practicando', racha >= 5, 'var(--coral)'],
  ];
  return `<div class="badges">${L.map(([i, t, d, ok, c]) => `<div class="badge ${ok ? '' : 'locked'}" style="--bc:${c}"><span class="bm">${ic(i, 28)}</span><b>${t}</b><span class="xs muted">${d}</span></div>`).join('')}</div>`;
}
function evolucionEst(res) {
  const D = [...res].reverse(); if (D.length < 2) return '<p class="small muted">Con dos simulacros o más verá aquí su evolución.</p>';
  const W = 720, H = 220, pl = 40, pr = 20, pt = 22, pb = 30, max = 500;
  const x = i => pl + i * (W - pl - pr) / (D.length - 1), y = v => pt + (1 - v / max) * (H - pt - pb);
  const ln = D.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d.global).toFixed(1)}`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" class="evo" role="img" aria-label="Mi puntaje global en cada simulacro">${[0, 250, 500].map(t => `<line x1="${pl}" x2="${W - pr}" y1="${y(t)}" y2="${y(t)}" stroke="var(--line)"/><text x="${pl - 8}" y="${y(t) + 4}" text-anchor="end" font-size="11" fill="var(--muted)">${t}</text>`).join('')}
    <path d="${ln}L${x(D.length - 1)},${y(0)}L${x(0)},${y(0)}Z" fill="var(--brand-soft)" opacity=".6"/><path d="${ln}" fill="none" stroke="var(--brand)" stroke-width="2.5" stroke-linejoin="round"/>
    ${D.map((d, i) => `<circle cx="${x(i)}" cy="${y(d.global)}" r="5" fill="var(--brand)" stroke="var(--surface)" stroke-width="2"><title>${esc(d.simulacro)}: ${d.global}</title></circle><text x="${x(i)}" y="${y(d.global) - 11}" text-anchor="middle" font-size="12" font-weight="700" fill="var(--ink)">${d.global}</text><text x="${x(i)}" y="${H - 9}" text-anchor="middle" font-size="11" fill="var(--muted)">${esc(String(d.simulacro).replace('Simulacro ', 'S'))}</text>`).join('')}</svg>`;
}
async function resultados({ S, main }) {
  main.innerHTML = cargando();
  const [res, plan] = await Promise.all([rpc('mis_resultados'), rpc('mi_plan').catch(() => null)]);
  if (!res.length) { main.innerHTML = `${head('Simulacros ICFES', 'Mis resultados')}<div class="card">${vacio('i-results', 'Todavía no hay resultados', 'Los verá cuando termine el tiempo de su primer simulacro.')}</div>${corp}`; return; }
  let k = 0;
  const pintar = () => {
    const r = res[k], vals = [0, 1, 2, 3, 4].map(i => (r.areas.find(x => x.area === i) || { puntaje: 0 }).puntaje);
    main.innerHTML = `${head(`${esc(r.simulacro)} · ${fecha(r.fecha)}`, 'Mis resultados', `${res.length > 1 ? `<div class="field"><label for="rsel">Simulacro</label><select id="rsel">${res.map((x, i) => `<option value="${i}" ${i === k ? 'selected' : ''}>${esc(x.simulacro)}</option>`).join('')}</select></div>` : ''}<button class="btn sec" type="button" data-ir="honor">${ic('i-trophy', 18)}Cuadro de honor</button>`,
        { sub: `Puntaje global <b>${r.global}</b> de 500. Promedio de su grupo: ${r.grupo_promedio ?? '—'}.` })}
      <div class="grid g3">
        <div class="card tile2"><span class="lbl">Puntaje global</span><span class="v"><span data-contar="${r.global}">${r.global}</span><span class="muted" style="font-size:18px"> / 500</span></span><span class="xs muted">Las cuatro áreas pesan 3 veces e Inglés 1 vez, como el ICFES.</span></div>
        <div class="card tile2" style="--tc:var(--coral)"><span class="lbl">Puesto en el grupo</span><div class="row" style="gap:14px;flex-wrap:nowrap"><div class="medal"><div>${r.puesto}.º<small>puesto</small></div></div><span class="small muted">de ${r.total} estudiantes</span></div></div>
        <div class="card tile2" style="--tc:var(--a4)"><span class="lbl">Puesto en el colegio</span><span class="v">${r.puesto_colegio}.º<span class="muted" style="font-size:18px"> de ${r.total_colegio}</span></span><span class="xs muted">Entre quienes presentaron este simulacro</span></div>
      </div>
      <div class="bento">
        <div class="card w5" style="place-items:center">${rings5(vals, 220, r.global, 'global')}</div>
        <div class="card w7"><span class="lbl">Por área</span>${vals.map((v, i) => `<div style="display:grid;grid-template-columns:150px minmax(0,1fr) 40px 80px;gap:10px;align-items:center"><span class="row" style="gap:8px;flex-wrap:nowrap">${aico(i, 28)}<b class="small">${AREAS[i]}</b></span>${barra(v, col(i))}<b class="num" style="text-align:right">${v}</b>${lvlTag(i, v)}</div>`).join('')}<p class="xs muted">En los simulacros no se muestran las respuestas correctas. Practique sus áreas débiles en el plan de refuerzo.</p></div>
        <div class="card w12"><div><span class="lbl">Evolución</span><h2>Mi puntaje en cada simulacro</h2></div>${evolucionEst(res)}</div>
        <div class="card w12"><div><span class="lbl">Logros</span><h2>Mis medallas</h2></div>${medallas(res, plan?.racha || 0)}</div>
      </div>${corp}`;
    const sel = $('#rsel'); if (sel) sel.onchange = () => { k = +sel.value; pintar(); document.dispatchEvent(new Event('f-pintado')); };
  };
  pintar();
}

async function perfil({ S, main }) {
  const p = S.perfil;
  main.innerHTML = `${head('Mi cuenta', 'Perfil')}<div class="card" style="max-width:560px"><div class="row" style="gap:16px"><span class="av" style="width:64px;height:64px;font-size:20px;border-radius:18px">${esc(iniciales(p.nombres + ' ' + p.apellidos))}</span><div><b style="font-size:19px">${esc(p.nombres)} ${esc(p.apellidos)}</b><br><span class="muted small">Documento ${esc(p.documento || '')}</span>${S.grupo ? `<br><span class="xs muted">Grado ${S.grupo.grado}-${esc(S.grupo.nombre)} · ${esc(S.colegio?.nombre || '')}</span>` : ''}</div></div>
    <div class="row"><button class="btn sec" type="button" data-cambiar-clave>${ic('i-key')}Cambiar contraseña</button><button class="btn ghost" type="button" data-salir>${ic('i-exit')}Cerrar sesión</button></div></div>${corp}`;
}
