// FORTALECER · pantallas del docente: inicio, exámenes, editor, resultados, banco y notas
import { $, $$, esc, ic, AREAS, head, volverBtn, cargando, corp, iniciales, vacio, errorMsg, toast, modal, cerrarModal, confirmar, pill, field, selectField,
  fecha, fechaHora, hora, notaTxt, notaHTML, notaCls, descargarExcel, leerExcel, normal } from './lib.js';
import { sb, q, rpc, subirArchivo } from './api.js';
import { reporteAplicacion, listaAplicaciones, evolucionHTML } from './reportes.js';
import { avisosHTML } from './avisos.js';

export async function render(ctx) {
  const { seccion } = ctx;
  if (seccion === 'examenes') return examenes(ctx);
  if (seccion === 'editor') return editor(ctx);
  if (seccion === 'resultados_ex') return resultadosEx(ctx);
  if (seccion === 'banco') return banco(ctx);
  if (seccion === 'notas') return notas(ctx);
  if (seccion === 'reportes') return reportesIcfes(ctx);
  if (seccion === 'perfil') return perfil(ctx);
  return inicio(ctx);
}

// ---------- Tipos de pregunta ----------
export const TIPOS = {
  una: ['Una correcta', 'i-check2', 't-una'],
  varias: ['Varias correctas', 'i-list', 't-varias'],
  vf: ['Falso o verdadero', 'i-vf', 't-vf'],
  completar: ['Completar', 'i-text', 't-completar'],
  relacionar: ['Relacionar', 'i-link', 't-relacionar'],
  ordenar: ['Ordenar pasos', 'i-sort', 't-ordenar'],
};
const LETRAS = 'ABCDEF';
const tipoTag = t => `<span class="ttag ${TIPOS[t][2]}">${ic(TIPOS[t][1], 13)}${TIPOS[t][0]}</span>`;
const nuevaPregunta = tipo => ({
  tipo, enunciado: '', imagen_url: '', valor: 1, explicacion: '', lectura: '',
  opciones: tipo === 'una' || tipo === 'varias' ? { A: '', B: '', C: '', D: '' } : tipo === 'relacionar' ? { izq: ['', '', ''], der: ['', '', ''] } : tipo === 'ordenar' ? { pasos: ['', '', ''] } : null,
  clave: tipo === 'varias' ? [] : tipo === 'completar' ? [''] : tipo === 'una' || tipo === 'vf' ? '' : null,
});
// ¿Le falta algo a la pregunta? Devuelve el problema en palabras sencillas, o ''.
export function faltaEn(p) {
  if (!String(p.enunciado || '').trim() && !p.imagen_url) return 'Falta escribir la pregunta';
  if (p.tipo === 'una' || p.tipo === 'varias') {
    const llenas = Object.entries(p.opciones || {}).filter(([, v]) => String(v).trim());
    if (llenas.length < 2) return 'Escriba al menos dos opciones';
    if (p.tipo === 'una' && !(p.clave && String(p.opciones[p.clave] || '').trim())) return 'Marque la opción correcta';
    if (p.tipo === 'varias' && !(Array.isArray(p.clave) && p.clave.filter(k => String(p.opciones[k] || '').trim()).length)) return 'Marque las opciones correctas';
  }
  if (p.tipo === 'vf' && !['V', 'F'].includes(p.clave)) return 'Elija si es verdadero o falso';
  if (p.tipo === 'completar' && !(p.clave || []).some(x => String(x).trim())) return 'Escriba la respuesta que se acepta';
  if (p.tipo === 'relacionar' && (p.opciones.izq || []).filter((x, i) => String(x).trim() && String(p.opciones.der[i] || '').trim()).length < 2) return 'Escriba al menos dos parejas';
  if (p.tipo === 'ordenar' && (p.opciones.pasos || []).filter(x => String(x).trim()).length < 2) return 'Escriba al menos dos pasos';
  return '';
}
// Limpia la pregunta antes de guardarla (quita opciones vacías y vuelve a poner las letras)
export function limpiar(p) {
  const x = { ...p, valor: Math.max(0.5, Math.min(100, Number(p.valor) || 1)) };
  if (p.tipo === 'una' || p.tipo === 'varias') {
    const vivas = Object.keys(p.opciones).filter(k => String(p.opciones[k]).trim());
    const op = {}, mapa = {};
    vivas.forEach((k, i) => { op[LETRAS[i]] = String(p.opciones[k]).trim(); mapa[k] = LETRAS[i]; });
    x.opciones = op;
    x.clave = p.tipo === 'una' ? (mapa[p.clave] || '') : (p.clave || []).map(k => mapa[k]).filter(Boolean).sort();
  }
  if (p.tipo === 'completar') x.clave = (p.clave || []).map(s => String(s).trim()).filter(Boolean);
  if (p.tipo === 'relacionar') {
    const pares = p.opciones.izq.map((a, i) => [String(a).trim(), String(p.opciones.der[i] || '').trim()]).filter(([a, b]) => a && b);
    x.opciones = { izq: pares.map(z => z[0]), der: pares.map(z => z[1]) }; x.clave = null;
  }
  if (p.tipo === 'ordenar') { x.opciones = { pasos: p.opciones.pasos.map(s => String(s).trim()).filter(Boolean) }; x.clave = null; }
  if (p.tipo === 'vf') x.opciones = null;
  return x;
}

async function misGrupos(S) {
  const [dg, as] = await Promise.all([q(sb.from('docente_grupos').select('grupo_id').eq('docente_id', S.perfil.id)), q(sb.from('asignaciones').select('grupo_id,materia_id').eq('docente_id', S.perfil.id))]);
  const ids = [...new Set([...dg.map(x => x.grupo_id), ...as.map(x => x.grupo_id)])];
  const grupos = ids.length ? (await q(sb.from('grupos').select('*').in('id', ids))).sort((a, b) => a.grado - b.grado || a.nombre.localeCompare(b.nombre)) : [];
  return { grupos, asignaciones: as };
}
const estadoExamen = (gs) => {
  if (!gs.length) return ['Sin programar', 'p-mute'];
  const ahora = Date.now();
  if (gs.some(g => new Date(g.apertura) <= ahora && new Date(g.fin) > ahora)) return ['Abierto ahora', 'p-ok'];
  if (gs.some(g => new Date(g.apertura) > ahora)) return ['Programado', 'p-info'];
  return ['Cerrado', 'p-brand'];
};

// ---------- Inicio ----------
async function inicio({ S, main, go }) {
  main.innerHTML = cargando();
  const [P, avHTML] = await Promise.all([rpc('panel_docente'), avisosHTML({ S })]);
  const esc_ = P.escala, d = esc_.decimales;
  const nombre = esc(S.perfil.nombres.split(' ')[0]);
  const abiertos = P.examenes.filter(e => new Date(e.apertura) <= Date.now() && new Date(e.fin) > Date.now());
  const prom = a => a.length ? a.reduce((s, x) => s + Number(x), 0) / a.length : null;
  const tarjetas = P.tarjetas.map((t, i) => {
    const p = prom(t.notas), bajo = t.notas.filter(n => Number(n) < Number(esc_.aprobar)).length;
    return `<button class="card tile2 tarjeta-g" type="button" data-grupo="${t.grupo_id}" style="--tc:var(--a${i % 5 + 1});text-align:left;cursor:pointer;font:inherit;color:inherit">
      <div class="row between"><span class="lbl">${esc(t.materia)}</span>${pill('Grupo ' + esc(t.grupo), 'p-mute')}</div>
      <span class="v ${notaCls(p, esc_)}" style="color:var(--${p == null ? 'muted' : notaCls(p, esc_)})">${p == null ? '—' : `<span data-contar="${p.toFixed(d)}" data-dec="${d}">${notaTxt(p, d)}</span>`}</span>
      <span class="small muted">${p == null ? 'Aún sin notas en este período' : `Promedio de ${t.notas.length} de ${t.estudiantes} estudiantes`}</span>
      ${bajo ? `<span class="xs" style="color:var(--bad);font-weight:700">${bajo} por debajo de ${notaTxt(esc_.aprobar, d)}</span>` : ''}</button>`;
  }).join('');
  const semana = P.examenes.length ? P.examenes.map(e => {
    const ab = new Date(e.apertura) <= Date.now() && new Date(e.fin) > Date.now(), fut = new Date(e.apertura) > Date.now();
    return `<div class="pend ${ab ? 'hot' : ''}"><div class="cnt"><b>${ab ? `${e.entregaron}/${e.estudiantes}` : new Date(e.apertura).getDate()}</b><span>${ab ? 'entregaron' : new Intl.DateTimeFormat('es-CO', { month: 'short' }).format(new Date(e.apertura))}</span></div>
      <div class="tx"><b>${esc(e.titulo)}</b><span class="xs muted">${esc(e.materia || 'Sin materia')} · Grupo ${esc(e.grupo)} · ${fut ? 'abre ' + fechaHora(e.apertura) : ab ? 'cierra ' + fechaHora(e.fin) : 'cerró ' + fechaHora(e.fin)}</span></div>
      <button class="btn ${ab ? 'hot' : 'sec'} sm" type="button" data-res="${e.id}">${ab ? 'Ver sala' : 'Resultados'}</button></div>`;
  }).join('') : vacio('i-cal', 'No hay exámenes esta semana', 'Cree uno y prográmelo para sus grupos.', `<button class="btn pri sm" type="button" data-accion="nuevo">${ic('i-plus', 16)}Crear examen</button>`);
  const TA = { sospecha: ['Sospecha', 'bad'], no_presento: ['Pendientes', 'warn'], bajo: ['Bajó', 'mute'] };
  const alertas = P.alertas.length ? P.alertas.slice(0, 6).map(a => `<div class="alerta-i ${TA[a.tipo][1]}"><b class="t">${TA[a.tipo][0]}</b><span>${a.tipo === 'sospecha' ? `<b>${esc(a.estudiante)}</b> (${esc(a.grupo)}) · ${esc(a.examen)}. ${esc(a.detalle || '')}`
    : a.tipo === 'no_presento' ? `<b>${a.cantidad}</b> estudiantes de ${esc(a.grupo)} aún no empiezan «${esc(a.examen)}».`
    : `<b>${esc(a.estudiante)}</b> (${esc(a.grupo)}) bajó en ${esc(a.materia || '')}: de ${notaTxt(a.antes, d)} a ${notaTxt(a.ahora, d)}.`}</span></div>`).join('')
    : `<p class="small muted">Nada que revisar por ahora.</p>`;
  main.innerHTML = `${head(P.periodo ? esc(P.periodo.nombre) : 'Docente', `Hola, ${nombre}.`, `<button class="btn pri" type="button" data-accion="nuevo">${ic('i-plus', 18)}Crear examen</button><button class="btn sec" type="button" data-ir="banco">${ic('i-bank', 18)}Mi banco</button>`,
    { sub: abiertos.length ? `Tiene <b>${abiertos.length} ${abiertos.length === 1 ? 'examen abierto' : 'exámenes abiertos'}</b> en este momento.` : P.tarjetas.length ? `Estas son sus materias y grupos del período.` : 'La coordinación aún no le ha asignado materias. Mientras tanto puede preparar exámenes.' })}
    ${P.tarjetas.length ? `<div class="grid g3">${tarjetas}</div>` : `<div class="card">${vacio('i-users', 'Aún no tiene materias asignadas', 'Pida a la coordinación que le asigne sus materias en cada grupo.')}</div>`}
    <div class="bento">
      <div class="card w7"><div><span class="lbl">Esta semana</span><h2>Mis exámenes</h2></div><div style="display:grid;gap:10px">${semana}</div></div>
      <div class="card w5"><div><span class="lbl">Para revisar</span><h2>Alertas</h2></div><div style="display:grid;gap:8px">${alertas}</div></div>
      ${P.icfes ? `<div class="card w12"><div class="row between"><div><span class="lbl">Simulacro ICFES</span><h2>${esc(P.icfes.simulacro)} · Grupo ${esc(P.icfes.grupo)}</h2><p class="small muted">${P.icfes.area != null ? `Vea cómo le fue a su grupo en ${AREAS[P.icfes.area]}, pregunta por pregunta.` : 'Vea los resultados de su grupo.'}</p></div><button class="btn sec" type="button" data-ir="reportes/${P.icfes.aplicacion}">Ver reporte <span class="fl">→</span></button></div></div>` : ''}
      ${avHTML}
    </div>${corp}`;
  main.onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.res) go('resultados_ex/' + b.dataset.res);
    if (b.dataset.grupo) go('notas/' + b.dataset.grupo);
  };
}

// ---------- Lista de exámenes ----------
async function examenes({ S, main, go, recargar }) {
  main.innerHTML = cargando();
  const ex = await q(sb.from('examenes_doc').select('*').eq('docente_id', S.perfil.id).order('creado_en', { ascending: false }));
  const ids = ex.map(e => e.id);
  const [gs, pq, mats, { grupos }] = await Promise.all([
    ids.length ? q(sb.from('examen_grupos').select('*').in('examen_id', ids)) : [],
    ids.length ? q(sb.from('preguntas_doc').select('examen_id').in('examen_id', ids)) : [],
    q(sb.from('materias').select('id,nombre')), misGrupos(S)]);
  const gN = Object.fromEntries(grupos.map(g => [g.id, `${g.grado}-${g.nombre}`])), mN = Object.fromEntries(mats.map(m => [m.id, m.nombre]));
  let filtro = 'todos';
  const pintar = () => {
    const lista = ex.map(e => {
      const g = gs.filter(x => x.examen_id === e.id).map(x => ({ ...x, fin: x.cierre || new Date(new Date(x.apertura).getTime() + e.duracion_min * 60000).toISOString() }));
      return { e, g, est: estadoExamen(g), n: pq.filter(x => x.examen_id === e.id).length };
    }).filter(x => filtro === 'todos' || (filtro === 'talleres' ? x.e.es_taller : filtro === 'abiertos' ? x.est[0] === 'Abierto ahora' : filtro === 'borradores' ? !x.g.length : true));
    $('#lista').innerHTML = lista.length ? lista.map(({ e, g, est, n }) => `<div class="card" style="gap:10px">
      <div class="row between"><div class="row" style="gap:12px;flex-wrap:nowrap;min-width:0"><span class="aico" style="background:var(--brand-soft);color:var(--brand)">${ic(e.es_taller ? 'i-up' : 'i-exam', 20)}</span><div style="min-width:0"><b style="font-size:17px">${esc(e.titulo)}</b><div class="xs muted">${esc(mN[e.materia_id] || 'Sin materia')} · ${n} ${n === 1 ? 'pregunta' : 'preguntas'} · ${e.modo === 'fijo' ? `${e.duracion_min} min, todos a la vez` : 'ventana de días'}${e.intentos > 1 ? ` · ${e.intentos} intentos` : ''}${e.es_taller ? ' · taller de práctica' : ''}</div></div></div>${pill(est[0], est[1])}</div>
      ${g.length ? `<div class="row" style="gap:6px">${g.map(x => `<span class="chip" style="background:var(--surface-2);color:var(--ink)">${esc(gN[x.grupo_id] || 'Grupo')} · ${fechaHora(x.apertura)}</span>`).join('')}</div>` : ''}
      <div class="row"><button class="btn sec sm" type="button" data-editar="${e.id}">${ic('i-edit', 15)}${g.length ? 'Ver o editar' : 'Editar'}</button><button class="btn sec sm" type="button" data-prog="${e.id}">${ic('i-cal', 15)}Programar</button>${g.length ? `<button class="btn sec sm" type="button" data-res="${e.id}">${ic('i-results', 15)}Resultados</button>` : ''}<button class="btn ghost sm" type="button" data-dup="${e.id}">Duplicar</button><button class="btn ghost sm" type="button" data-del="${e.id}" style="color:var(--bad)">Borrar</button></div></div>`).join('')
      : `<div class="card">${vacio('i-exam', filtro === 'todos' ? 'Aún no tiene exámenes' : 'No hay exámenes en este filtro', 'Cree su primer examen: puede escribir las preguntas, traerlas de su banco o de un Excel.', `<button class="btn pri sm" type="button" data-accion="nuevo">${ic('i-plus', 16)}Crear examen</button>`)}</div>`;
  };
  main.innerHTML = `${head(`${ex.length} ${ex.length === 1 ? 'examen' : 'exámenes'}`, 'Mis exámenes', `<button class="btn pri" type="button" data-accion="nuevo">${ic('i-plus', 18)}Crear examen</button><button class="btn sec" type="button" data-ir="banco">${ic('i-bank', 18)}Mi banco</button>`)}
    <div class="card" style="padding:12px 16px"><div class="seg2" role="group" aria-label="Filtro">${[['todos', 'Todos'], ['abiertos', 'Abiertos ahora'], ['borradores', 'Sin programar'], ['talleres', 'Talleres']].map(([k, t]) => `<button type="button" data-f="${k}" aria-pressed="${k === filtro}">${t}</button>`).join('')}</div></div>
    <div id="lista" style="display:grid;gap:14px"></div>${corp}`;
  pintar();
  main.onclick = async e => {
    const b = e.target.closest('button'); if (!b) return; const d = b.dataset;
    if (d.f) { filtro = d.f; $$('.seg2 button').forEach(x => x.setAttribute('aria-pressed', x.dataset.f === filtro)); pintar(); }
    if (d.editar) go('editor/' + d.editar);
    if (d.res) go('resultados_ex/' + d.res);
    if (d.prog) programar(S, ex.find(x => x.id === d.prog), recargar);
    if (d.dup) { try { const id = await rpc('doc_duplicar', { p_examen: d.dup }); toast('Se creó una copia. Ya puede cambiarla.'); go('editor/' + id); } catch (er) { toast(errorMsg(er), 'error'); } }
    if (d.del) {
      const x = ex.find(y => y.id === d.del);
      const ok = await confirmar({ titulo: '¿Borrar este examen?', texto: `Se borrará «${esc(x.titulo)}» con sus preguntas${gs.some(g => g.examen_id === x.id) ? ' y las notas que tenga' : ''}. No se puede deshacer.`, si: 'Sí, borrar', peligro: true });
      if (!ok) return;
      try { await rpc('doc_eliminar', { p_examen: x.id, p_con_notas: true }); toast('Examen borrado.'); recargar(); } catch (er) { toast(errorMsg(er), 'error'); }
    }
  };
}

// ---------- Programar ----------
const local = d => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 16); };
async function programar(S, e, alTerminar) {
  const [{ grupos, asignaciones }, gs] = await Promise.all([misGrupos(S), q(sb.from('examen_grupos').select('*').eq('examen_id', e.id))]);
  if (!grupos.length) return toast('Aún no tiene grupos asignados. Pida a la coordinación que le asigne sus materias.', 'error');
  const propios = e.materia_id ? grupos.filter(g => asignaciones.some(a => a.grupo_id === g.id && a.materia_id === e.materia_id)) : [];
  const orden = [...propios, ...grupos.filter(g => !propios.includes(g))];
  const man = new Date(); man.setDate(man.getDate() + 1); man.setHours(7, 0, 0, 0);
  const fin = new Date(man); fin.setDate(fin.getDate() + 3); fin.setHours(23, 0, 0, 0);
  const filas = orden.map(g => { const x = gs.find(y => y.grupo_id === g.id); return `<div class="pend" style="flex-wrap:wrap"><label class="chk" style="min-width:150px"><input type="checkbox" name="g" value="${g.id}" ${x ? 'checked' : ''}> Grupo ${g.grado}-${esc(g.nombre)}${propios.includes(g) ? '' : ' <span class="xs muted">(otra materia)</span>'}</label>
    <div class="field" style="flex:1;min-width:170px"><label>${e.modo === 'fijo' ? 'Empieza' : 'Abre'}</label><input type="datetime-local" data-ap="${g.id}" value="${local(x?.apertura || man)}"></div>
    ${e.modo === 'ventana' ? `<div class="field" style="flex:1;min-width:170px"><label>Cierra</label><input type="datetime-local" data-ci="${g.id}" value="${local(x?.cierre || fin)}"></div>` : ''}</div>`; }).join('');
  const w = modal({ icon: 'i-cal', titulo: 'Programar el examen', sub: esc(e.titulo), ancho: true, form: true,
    cuerpo: `<p class="small muted">${e.modo === 'fijo' ? `Todos empiezan a la misma hora y tienen <b>${e.duracion_min} minutos</b>.` : `Cada estudiante entra cuando quiera entre la apertura y el cierre, y tiene <b>${e.duracion_min} minutos</b> desde que empieza.`} Marque los grupos.</p><div style="display:grid;gap:10px">${filas}</div>`,
    pie: `<button class="btn sec" type="button" data-cerrar>Cancelar</button><button class="btn pri" type="submit">Programar</button>` });
  w.querySelector('form').onsubmit = async ev => {
    ev.preventDefault();
    const sel = $$('input[name=g]:checked', w).map(i => i.value);
    if (!sel.length) return toast('Marque al menos un grupo.', 'error');
    const p = sel.map(id => ({ grupo_id: id, apertura: new Date($(`[data-ap="${id}"]`, w).value).toISOString(), cierre: e.modo === 'ventana' ? new Date($(`[data-ci="${id}"]`, w).value).toISOString() : null }));
    try { await rpc('doc_programar', { p_examen: e.id, p_grupos: p }); cerrarModal(); toast(`Listo. El examen quedó programado para ${sel.length} ${sel.length === 1 ? 'grupo' : 'grupos'}.`); alTerminar?.(); }
    catch (er) { toast(errorMsg(er), 'error'); }
  };
}

// ---------- Editor ----------
let ED = null;
async function editor({ S, main, params, go }) {
  main.innerHTML = cargando();
  const id = params[0] && params[0] !== 'nuevo' ? params[0] : null;
  const [mats, pers, { asignaciones }] = await Promise.all([q(sb.from('materias').select('id,nombre').order('nombre')), q(sb.from('periodos').select('*').order('inicio')), misGrupos(S)]);
  const misMat = [...new Set(asignaciones.map(a => a.materia_id))];
  let ex;
  if (id) {
    const d = await rpc('doc_examen', { p_id: id });
    ex = { ...d, preguntas: d.preguntas.map(p => ({ ...p, lectura: p.lectura || '', imagen_url: p.imagen_url || '', explicacion: p.explicacion || '', clave: p.clave ?? (p.tipo === 'varias' ? [] : p.tipo === 'completar' ? [''] : '') })) };
    ex.preguntas.forEach(p => { if (p.tipo === 'completar' && !p.clave.length) p.clave = ['']; });
  } else ex = { titulo: '', instrucciones: '', materia_id: misMat[0] || '', periodo_id: S.periodo?.id || '', modo: 'fijo', duracion_min: 60, intentos: 1, cuenta: 'mejor', antifraude: true, presentacion: 'una', mezclar: true, mostrar_respuestas: true, es_taller: false, lecturas: [], preguntas: [] };
  ED = { S, main, go, ex, mats, misMat, pers, cambios: false, bloqueado: !!ex.bloqueado };
  pintarEditor();
}
const lecturaDe = ref => ED.ex.lecturas.find(l => String(l.ref) === String(ref));
function pintarEditor() {
  const { ex, mats, misMat, pers, bloqueado } = ED;
  const dis = bloqueado ? 'disabled' : '';
  const total = ex.preguntas.reduce((s, p) => s + (Number(p.valor) || 0), 0);
  const faltas = ex.preguntas.map((p, i) => [i, faltaEn(p)]).filter(x => x[1]);
  const matOps = [['', 'Sin materia'], ...mats.filter(m => misMat.includes(m.id)).map(m => [m.id, m.nombre]), ...mats.filter(m => !misMat.includes(m.id)).map(m => [m.id, m.nombre + ' (no asignada)'])];
  let html = '', vistas = new Set();
  ex.preguntas.forEach((p, i) => {
    if (p.lectura && !vistas.has(String(p.lectura))) {
      vistas.add(String(p.lectura));
      const l = lecturaDe(p.lectura) || {};
      const k = ex.lecturas.indexOf(l);
      html += `<div class="lec" data-lec="${k}"><div class="row between"><span class="ttag t-lectura">${ic('a-book', 13)}Lectura con varias preguntas</span>${bloqueado ? '' : `<div class="row" style="gap:6px"><button class="btn ghost sm" type="button" data-lecimg="${k}">${ic('i-image', 15)}Imagen</button><button class="btn ghost sm" type="button" data-lecdel="${k}" style="color:var(--bad)">Quitar lectura</button></div>`}</div>
        <input class="tx" data-lf="titulo" data-lk="${k}" value="${esc(l.titulo || '')}" placeholder="Título de la lectura (opcional)" ${dis} style="border:1.5px solid var(--line);border-radius:12px;padding:10px 12px;background:var(--surface)">
        <textarea data-lf="texto" data-lk="${k}" rows="6" placeholder="Pegue aquí el texto que los estudiantes deben leer" ${dis} style="border:1.5px solid var(--line);border-radius:12px;padding:12px;background:var(--surface);font:inherit;resize:vertical">${esc(l.texto || '')}</textarea>
        ${l.imagen_url ? `<img class="thumbq" src="${esc(l.imagen_url)}" alt="Imagen de la lectura">` : ''}</div>`;
    }
    html += preguntaHTML(p, i, dis);
    const sig = ex.preguntas[i + 1];
    if (p.lectura && (!sig || String(sig.lectura) !== String(p.lectura)) && !bloqueado) html += `<button class="btn sec sm" type="button" data-addlec="${esc(p.lectura)}" style="justify-self:start;margin-top:-6px">${ic('i-plus', 15)}Otra pregunta sobre esta lectura</button>`;
  });
  const agregar = bloqueado ? '' : `<div class="card"><div><span class="lbl">Agregar</span><h3>¿Qué tipo de pregunta?</h3></div><div class="addt">${Object.entries(TIPOS).map(([k, [t, i, c]]) => `<button type="button" class="${c}" data-add="${k}">${ic(i, 20)}${t}</button>`).join('')}<button type="button" class="t-lectura" data-add="lectura">${ic('a-book', 20)}Lectura con preguntas</button></div>
    <div class="row"><button class="btn sec sm" type="button" data-traer>${ic('i-bank', 16)}Traer de mi banco</button><button class="btn sec sm" type="button" data-excel>${ic('i-upload', 16)}Cargar desde Excel</button><button class="btn ghost sm" type="button" data-plantilla>${ic('i-down', 16)}Plantilla de Excel</button></div></div>`;
  const tog = (k, t, sub) => `<label class="chk" style="justify-content:space-between;gap:12px;font-weight:600"><span><b>${t}</b>${sub ? `<br><span class="xs muted" style="font-weight:500">${sub}</span>` : ''}</span><input type="checkbox" data-cfg="${k}" ${ex[k] ? 'checked' : ''} ${dis}></label>`;
  ED.main.innerHTML = `${head(ex.id ? 'Editar examen' : 'Examen nuevo', esc(ex.titulo || 'Examen sin título'), bloqueado ? `<button class="btn pri" type="button" data-dup>${ic('i-plus', 18)}Duplicar para cambiarlo</button>` : `<button class="btn sec" type="button" data-guardar>${ic('i-sync', 18)}Guardar</button><button class="btn pri" type="button" data-guardarprog>${ic('i-cal', 18)}Guardar y programar</button>`, { volver: volverBtn('examenes', 'Mis exámenes') })}
    ${bloqueado ? `<div class="alert a-warn">${ic('i-warn')}<div><b>Este examen ya fue presentado</b>Para que todos tengan el mismo examen, ya no se puede cambiar. Use «Duplicar para cambiarlo» si quiere una versión nueva.</div></div>` : ''}
    <div class="ed">
      <div style="display:grid;gap:16px;min-width:0" id="qs">${html || `<div class="card">${vacio('i-exam', 'El examen aún no tiene preguntas', 'Elija abajo el tipo de pregunta que quiere agregar.')}</div>`}${agregar}</div>
      <aside class="ed-side">
        <div class="card" style="gap:12px"><span class="lbl">Datos del examen</span>
          ${field('e_titulo', 'Título', ex.titulo, `data-cfg="titulo" maxlength="140" placeholder="Ej.: Quiz de fracciones" ${dis}`)}
          ${selectField('e_materia', 'Materia', matOps, ex.materia_id || '')}
          ${pers.length ? selectField('e_periodo', 'Período', pers.map(p => [p.id, `${p.nombre} ${p.anio}`]), ex.periodo_id || '') : `<p class="xs muted">El colegio aún no ha creado períodos.</p>`}
          <div class="field"><label for="e_inst">Instrucciones (opcional)</label><textarea id="e_inst" data-cfg="instrucciones" rows="2" ${dis} style="border:1.5px solid var(--line);border-radius:12px;padding:10px;background:var(--surface-2);font:inherit">${esc(ex.instrucciones || '')}</textarea></div></div>
        <div class="card" style="gap:12px"><span class="lbl">Cómo se presenta</span>
          <div class="seg2" role="group" aria-label="Horario">${[['fijo', 'Todos a la vez'], ['ventana', 'Ventana de días']].map(([k, t]) => `<button type="button" data-modo="${k}" aria-pressed="${ex.modo === k}" ${dis}>${t}</button>`).join('')}</div>
          <p class="xs muted">${ex.modo === 'fijo' ? 'Todo el grupo empieza a la misma hora.' : 'Cada estudiante entra cuando quiera mientras esté abierto.'}</p>
          ${field('e_dur', 'Minutos para responder', ex.duracion_min, `type="number" min="5" max="600" data-cfg="duracion_min" ${dis}`)}
          ${selectField('e_int', 'Intentos', [1, 2, 3, 4, 5].map(n => [n, n === 1 ? '1 intento' : n + ' intentos']), ex.intentos)}
          ${ex.intentos > 1 ? selectField('e_cuenta', 'Nota que cuenta', [['mejor', 'La mejor nota'], ['ultima', 'La del último intento']], ex.cuenta) : ''}
          <div class="seg2" role="group" aria-label="Presentación">${[['una', 'Una pregunta por pantalla'], ['todas', 'Todas en una página']].map(([k, t]) => `<button type="button" data-pres="${k}" aria-pressed="${ex.presentacion === k}" ${dis}>${t}</button>`).join('')}</div>
          ${tog('antifraude', 'Control contra la copia', 'Advierte si sale de la ventana; a la segunda, cierra el examen')}
          ${tog('mezclar', 'Mezclar preguntas y opciones', 'Cada estudiante las ve en otro orden')}
          ${tog('mostrar_respuestas', 'Mostrar respuestas al cerrar', 'El estudiante revisa qué acertó cuando el examen se cierra')}
          ${tog('es_taller', 'Es un taller de práctica', 'No cuenta para la nota del período')}</div>
        <div class="card" style="gap:10px"><span class="lbl">Resumen</span>
          <div class="row between"><span>${ex.preguntas.length} ${ex.preguntas.length === 1 ? 'pregunta' : 'preguntas'}</span><b>${notaTxt(total, 1)} puntos</b></div>
          ${ex.preguntas.length ? faltas.length ? faltas.slice(0, 5).map(([i, f]) => `<button class="chk no" type="button" data-ir-q="${i}" style="border:0;background:none;padding:0;cursor:pointer;text-align:left">${ic('i-warn', 15)}Pregunta ${i + 1}: ${f}</button>`).join('') : `<span class="chk si">${ic('i-sync', 15)}Todas las preguntas están completas</span>` : ''}
          <p class="xs muted">La nota va de ${notaTxt(ED.S.colegio?.escala_min, ED.S.colegio?.decimales)} a ${notaTxt(ED.S.colegio?.escala_max, ED.S.colegio?.decimales)}. Cada pregunta vale lo que usted le ponga.</p></div>
      </aside></div>${corp}`;
  if (bloqueado) $$('#qs input, #qs textarea, #qs select, .ed-side select').forEach(x => x.disabled = true);
  ED.main.onclick = clickEditor; ED.main.oninput = inputEditor; ED.main.onchange = changeEditor;
}
function preguntaHTML(p, i, dis) {
  const f = faltaEn(p);
  const mark = p.tipo === 'varias' ? 'checkbox' : 'radio';
  let cuerpo = '';
  if (p.tipo === 'una' || p.tipo === 'varias') {
    cuerpo = Object.keys(p.opciones).map(k => { const ok = p.tipo === 'una' ? p.clave === k : (p.clave || []).includes(k);
      return `<div class="oprow"><label class="chk" title="Marcar como correcta"><input type="${mark}" name="ok${i}" data-clave="${i}" value="${k}" ${ok ? 'checked' : ''} ${dis}><b style="width:18px">${k}</b></label><input type="text" data-op="${i}" data-k="${k}" value="${esc(p.opciones[k])}" placeholder="Opción ${k}" ${dis}>${Object.keys(p.opciones).length > 2 && !dis ? `<button class="ibtn" type="button" data-opdel="${i}" data-k="${k}" aria-label="Quitar opción ${k}">${ic('i-x', 15)}</button>` : '<span></span>'}</div>`; }).join('')
      + (Object.keys(p.opciones).length < 6 && !dis ? `<button class="btn ghost sm" type="button" data-opadd="${i}" style="justify-self:start">${ic('i-plus', 15)}Otra opción</button>` : '')
      + `<p class="xs muted">${p.tipo === 'una' ? 'Marque el círculo de la opción correcta.' : 'Marque todas las correctas. Si el estudiante marca una incorrecta, se le descuenta.'}</p>`;
  }
  if (p.tipo === 'vf') cuerpo = `<div class="seg2" role="group" aria-label="Respuesta correcta">${[['V', 'Verdadero'], ['F', 'Falso']].map(([k, t]) => `<button type="button" data-vf="${i}" data-k="${k}" aria-pressed="${p.clave === k}" ${dis}>${t}</button>`).join('')}</div><p class="xs muted">Elija cuál es la respuesta correcta.</p>`;
  if (p.tipo === 'completar') cuerpo = `<p class="xs muted">En la pregunta, escriba <b>___</b> (tres rayas) donde va el espacio. Abajo, la respuesta correcta. Si se aceptan varias formas, agregue cada una. No importan las tildes ni las mayúsculas.</p>`
    + p.clave.map((r, j) => `<div class="oprow"><span class="chk">${ic('i-check2', 16)}</span><input type="text" data-comp="${i}" data-j="${j}" value="${esc(r)}" placeholder="${j ? 'Otra forma aceptada' : 'Respuesta correcta'}" ${dis}>${p.clave.length > 1 && !dis ? `<button class="ibtn" type="button" data-compdel="${i}" data-j="${j}" aria-label="Quitar">${ic('i-x', 15)}</button>` : '<span></span>'}</div>`).join('')
    + (!dis ? `<button class="btn ghost sm" type="button" data-compadd="${i}" style="justify-self:start">${ic('i-plus', 15)}Otra forma aceptada</button>` : '');
  if (p.tipo === 'relacionar') cuerpo = `<p class="xs muted">Escriba cada pareja en la misma fila. El estudiante verá la columna derecha en desorden.</p>`
    + p.opciones.izq.map((a, j) => `<div class="prow"><input data-rel="${i}" data-lado="izq" data-j="${j}" value="${esc(a)}" placeholder="Concepto ${j + 1}" ${dis}><span class="ar">→</span><input data-rel="${i}" data-lado="der" data-j="${j}" value="${esc(p.opciones.der[j] || '')}" placeholder="Pareja ${j + 1}" ${dis}>${p.opciones.izq.length > 2 && !dis ? `<button class="ibtn" type="button" data-reldel="${i}" data-j="${j}" aria-label="Quitar pareja">${ic('i-x', 15)}</button>` : '<span></span>'}</div>`).join('')
    + (p.opciones.izq.length < 10 && !dis ? `<button class="btn ghost sm" type="button" data-reladd="${i}" style="justify-self:start">${ic('i-plus', 15)}Otra pareja</button>` : '');
  if (p.tipo === 'ordenar') cuerpo = `<p class="xs muted">Escriba los pasos <b>en el orden correcto</b>. El estudiante los verá en desorden.</p>`
    + p.opciones.pasos.map((s, j) => `<div class="oprow"><b class="ix" style="width:28px;height:28px;border-radius:9px;display:grid;place-items:center;background:var(--brand);color:#fff;font-size:13px">${j + 1}</b><input type="text" data-paso="${i}" data-j="${j}" value="${esc(s)}" placeholder="Paso ${j + 1}" ${dis}>${!dis ? `<span class="row" style="gap:2px;flex-wrap:nowrap"><button class="ibtn" type="button" data-pasomv="${i}" data-j="${j}" data-d="-1" aria-label="Subir">↑</button><button class="ibtn" type="button" data-pasomv="${i}" data-j="${j}" data-d="1" aria-label="Bajar">↓</button>${p.opciones.pasos.length > 2 ? `<button class="ibtn" type="button" data-pasodel="${i}" data-j="${j}" aria-label="Quitar paso">${ic('i-x', 15)}</button>` : ''}</span>` : '<span></span>'}</div>`).join('')
    + (p.opciones.pasos.length < 10 && !dis ? `<button class="btn ghost sm" type="button" data-pasoadd="${i}" style="justify-self:start">${ic('i-plus', 15)}Otro paso</button>` : '');
  return `<article class="qe ${TIPOS[p.tipo][2]}" id="q${i}">
    <div class="qh"><span class="n">${i + 1}</span>${tipoTag(p.tipo)}${f ? `<span class="chk no xs">${ic('i-warn', 14)}${f}</span>` : ''}<span style="margin-left:auto" class="row"><label class="xs muted" for="v${i}">Vale</label><input id="v${i}" class="val" type="number" min="0.5" max="100" step="0.5" data-val="${i}" value="${esc(p.valor)}" ${dis}>
      ${!dis ? `<button class="ibtn" type="button" data-mv="${i}" data-d="-1" aria-label="Subir pregunta">↑</button><button class="ibtn" type="button" data-mv="${i}" data-d="1" aria-label="Bajar pregunta">↓</button>` : ''}</span></div>
    <div class="qb"><textarea data-enun="${i}" rows="2" placeholder="${p.tipo === 'completar' ? 'Ej.: El símbolo químico del potasio es ___.' : p.tipo === 'vf' ? 'Escriba la afirmación' : p.tipo === 'relacionar' ? 'Ej.: Relacione cada país con su capital' : p.tipo === 'ordenar' ? 'Ej.: Ordene los pasos del método científico' : 'Escriba la pregunta'}" ${dis}>${esc(p.enunciado)}</textarea>
      ${p.imagen_url ? `<div class="row"><img class="thumbq" src="${esc(p.imagen_url)}" alt="Imagen de la pregunta ${i + 1}">${!dis ? `<button class="btn ghost sm" type="button" data-imgdel="${i}" style="color:var(--bad)">Quitar imagen</button>` : ''}</div>` : ''}
      ${cuerpo}
      <details ${p.explicacion ? 'open' : ''}><summary class="xs muted" style="cursor:pointer;font-weight:700">Explicación para la revisión (opcional)</summary><textarea data-expl="${i}" rows="2" placeholder="Por qué esa es la respuesta correcta" ${dis} style="margin-top:8px">${esc(p.explicacion)}</textarea></details>
      ${!dis ? `<div class="row" style="gap:6px"><button class="btn ghost sm" type="button" data-img="${i}">${ic('i-image', 15)}${p.imagen_url ? 'Cambiar imagen' : 'Agregar imagen'}</button><button class="btn ghost sm" type="button" data-copiar="${i}">Duplicar</button><button class="btn ghost sm" type="button" data-abanco="${i}">${ic('i-bank', 15)}Guardar en mi banco</button><button class="btn ghost sm" type="button" data-qdel="${i}" style="color:var(--bad);margin-left:auto">Borrar</button></div>` : ''}
    </div></article>`;
}
const P_ = i => ED.ex.preguntas[+i];
function inputEditor(e) {
  const t = e.target, d = t.dataset; ED.cambios = true;
  if (d.cfg && t.type !== 'checkbox') { ED.ex[d.cfg] = d.cfg === 'duracion_min' ? +t.value : t.value; if (d.cfg === 'titulo') { const h = $('.band h1'); if (h) h.textContent = t.value || 'Examen sin título'; } return; }
  if (d.lf) { ED.ex.lecturas[+d.lk][d.lf] = t.value; return; }
  if (d.enun) P_(d.enun).enunciado = t.value;
  else if (d.expl) P_(d.expl).explicacion = t.value;
  else if (d.val) P_(d.val).valor = t.value;
  else if (d.op) P_(d.op).opciones[d.k] = t.value;
  else if (d.comp) P_(d.comp).clave[+d.j] = t.value;
  else if (d.rel) P_(d.rel).opciones[d.lado][+d.j] = t.value;
  else if (d.paso) P_(d.paso).opciones.pasos[+d.j] = t.value;
  else return;
  refrescarFalta(+(d.enun ?? d.expl ?? d.val ?? d.op ?? d.comp ?? d.rel ?? d.paso));
}
function refrescarFalta(i) {
  const art = $('#q' + i); if (!art) return;
  const f = faltaEn(P_(i)), chk = $('.qh .chk.no', art);
  if (f && chk) chk.lastChild.textContent = f;
  else if (f) $('.qh .n', art).insertAdjacentHTML('afterend', `<span class="chk no xs">${ic('i-warn', 14)}${f}</span>`);
  else chk?.remove();
}
function changeEditor(e) {
  const t = e.target, d = t.dataset; ED.cambios = true;
  if (t.id === 'e_materia') ED.ex.materia_id = t.value;
  if (t.id === 'e_periodo') ED.ex.periodo_id = t.value;
  if (t.id === 'e_int') { ED.ex.intentos = +t.value; pintarEditor(); }
  if (t.id === 'e_cuenta') ED.ex.cuenta = t.value;
  if (d.cfg && t.type === 'checkbox') ED.ex[d.cfg] = t.checked;
  if (d.clave !== undefined) {
    const p = P_(d.clave);
    if (p.tipo === 'una') p.clave = t.value;
    else p.clave = $$(`input[data-clave="${d.clave}"]:checked`).map(x => x.value);
    refrescarFalta(+d.clave);
  }
}
async function clickEditor(e) {
  const b = e.target.closest('button'); if (!b) return; const d = b.dataset, ex = ED.ex;
  const re = () => { ED.cambios = true; pintarEditor(); };
  if (d.modo) { ex.modo = d.modo; return re(); }
  if (d.pres) { ex.presentacion = d.pres; return re(); }
  if (d.irQ) return $('#q' + d.irQ)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  if (d.add) {
    if (d.add === 'lectura') { const ref = 'n' + Date.now(); ex.lecturas.push({ ref, titulo: '', texto: '', imagen_url: '' }); ex.preguntas.push({ ...nuevaPregunta('una'), lectura: ref }); }
    else ex.preguntas.push(nuevaPregunta(d.add));
    re(); setTimeout(() => { const a = $('#q' + (ex.preguntas.length - 1)); a?.scrollIntoView({ behavior: 'smooth', block: 'center' }); $('textarea', a)?.focus(); }, 60); return;
  }
  if (d.addlec) { const ult = ex.preguntas.map(p => String(p.lectura)).lastIndexOf(String(d.addlec)); ex.preguntas.splice(ult + 1, 0, { ...nuevaPregunta('una'), lectura: d.addlec }); return re(); }
  if (d.lecdel) { const l = ex.lecturas[+d.lecdel]; const ok = await confirmar({ titulo: '¿Quitar la lectura?', texto: 'Se quita el texto. Las preguntas quedan como preguntas sueltas.', si: 'Quitar' }); if (!ok) return; ex.preguntas.forEach(p => { if (String(p.lectura) === String(l.ref)) p.lectura = ''; }); ex.lecturas.splice(+d.lecdel, 1); return re(); }
  if (d.lecimg) return elegirImagen(url => { ex.lecturas[+d.lecimg].imagen_url = url; re(); });
  if (d.mv !== undefined) { const i = +d.mv, j = i + +d.d; if (j < 0 || j >= ex.preguntas.length) return; [ex.preguntas[i], ex.preguntas[j]] = [ex.preguntas[j], ex.preguntas[i]]; return re(); }
  if (d.qdel !== undefined) { ex.preguntas.splice(+d.qdel, 1); ex.lecturas = ex.lecturas.filter(l => ex.preguntas.some(p => String(p.lectura) === String(l.ref))); return re(); }
  if (d.copiar !== undefined) { ex.preguntas.splice(+d.copiar + 1, 0, JSON.parse(JSON.stringify(P_(d.copiar)))); return re(); }
  if (d.img !== undefined) return elegirImagen(url => { P_(d.img).imagen_url = url; re(); });
  if (d.imgdel !== undefined) { P_(d.imgdel).imagen_url = ''; return re(); }
  if (d.opadd !== undefined) { const p = P_(d.opadd), k = LETRAS[Object.keys(p.opciones).length]; p.opciones[k] = ''; return re(); }
  if (d.opdel !== undefined) {
    const p = P_(d.opdel), ks = Object.keys(p.opciones).filter(k => k !== d.k), op = {}, mapa = {};
    ks.forEach((k, j) => { op[LETRAS[j]] = p.opciones[k]; mapa[k] = LETRAS[j]; });
    p.opciones = op; p.clave = p.tipo === 'una' ? (mapa[p.clave] || '') : (p.clave || []).map(k => mapa[k]).filter(Boolean);
    return re();
  }
  if (d.vf !== undefined) { P_(d.vf).clave = d.k; return re(); }
  if (d.compadd !== undefined) { P_(d.compadd).clave.push(''); return re(); }
  if (d.compdel !== undefined) { P_(d.compdel).clave.splice(+d.j, 1); return re(); }
  if (d.reladd !== undefined) { const o = P_(d.reladd).opciones; o.izq.push(''); o.der.push(''); return re(); }
  if (d.reldel !== undefined) { const o = P_(d.reldel).opciones; o.izq.splice(+d.j, 1); o.der.splice(+d.j, 1); return re(); }
  if (d.pasoadd !== undefined) { P_(d.pasoadd).opciones.pasos.push(''); return re(); }
  if (d.pasodel !== undefined) { P_(d.pasodel).opciones.pasos.splice(+d.j, 1); return re(); }
  if (d.pasomv !== undefined) { const a = P_(d.pasomv).opciones.pasos, i = +d.j, j = i + +d.d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; return re(); }
  if (d.abanco !== undefined) return guardarEnBanco([P_(d.abanco)]);
  if ('traer' in d) return traerDelBanco();
  if ('excel' in d) return importarExcel();
  if ('plantilla' in d) return plantillaExcel();
  if ('dup' in d) { try { const id = await rpc('doc_duplicar', { p_examen: ex.id }); toast('Se creó una copia. Ya puede cambiarla.'); ED.go('editor/' + id); } catch (er) { toast(errorMsg(er), 'error'); } return; }
  if ('guardar' in d || 'guardarprog' in d) {
    const id = await guardarExamen(); if (!id) return;
    if ('guardarprog' in d) { const e2 = (await q(sb.from('examenes_doc').select('*').eq('id', id)))[0]; programar(ED.S, e2, () => ED.go('examenes')); }
    else if (!ex.id) ED.go('editor/' + id);
  }
}
async function guardarExamen() {
  const ex = ED.ex;
  if (String(ex.titulo || '').trim().length < 3) { toast('Escriba un título de al menos 3 letras.', 'error'); $('#e_titulo')?.focus(); return null; }
  if (!ex.preguntas.length) { toast('Agregue al menos una pregunta.', 'error'); return null; }
  const mal = ex.preguntas.findIndex(p => faltaEn(p));
  if (mal >= 0) { toast(`Pregunta ${mal + 1}: ${faltaEn(ex.preguntas[mal])}.`, 'error'); $('#q' + mal)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return null; }
  const dur = Math.round(Number(ex.duracion_min)); if (!(dur >= 5 && dur <= 600)) { toast('Los minutos deben estar entre 5 y 600.', 'error'); return null; }
  const p = { id: ex.id || '', titulo: ex.titulo, instrucciones: ex.instrucciones, materia_id: ex.materia_id || '', periodo_id: ex.periodo_id || '', modo: ex.modo, duracion_min: dur, intentos: ex.intentos, cuenta: ex.cuenta,
    antifraude: ex.antifraude, presentacion: ex.presentacion, mezclar: ex.mezclar, mostrar_respuestas: ex.mostrar_respuestas, es_taller: ex.es_taller,
    lecturas: ex.lecturas.map(l => ({ ref: String(l.ref), titulo: l.titulo, texto: l.texto, imagen_url: l.imagen_url })),
    preguntas: ex.preguntas.map(limpiar).map(x => ({ tipo: x.tipo, lectura: x.lectura ? String(x.lectura) : '', enunciado: x.enunciado, imagen_url: x.imagen_url, opciones: x.opciones, valor: x.valor, explicacion: x.explicacion, clave: x.clave })) };
  try { const id = await rpc('doc_guardar_examen', { p }); ED.cambios = false; toast('Examen guardado.'); return id; }
  catch (er) { toast(errorMsg(er), 'error'); return null; }
}
function elegirImagen(cb) {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
  inp.onchange = async () => {
    const f = inp.files[0]; if (!f) return;
    if (f.size > 3 * 1024 * 1024) return toast('La imagen pesa más de 3 MB. Use una más liviana.', 'error');
    toast('Subiendo imagen…');
    try { cb(await subirArchivo('examenes', f, `${ED.S.perfil.id}/img`)); toast('Imagen agregada.'); } catch (er) { toast(errorMsg(er), 'error'); }
  };
  inp.click();
}

// ---------- Banco del docente ----------
async function guardarEnBanco(ps) {
  const malas = ps.filter(p => faltaEn(p));
  if (malas.length) return toast('Complete la pregunta antes de guardarla en el banco.', 'error');
  const mat = ED?.mats.find(m => m.id === ED.ex.materia_id)?.nombre || null;
  try {
    await q(sb.from('banco_doc').insert(ps.map(limpiar).map(x => ({ materia: mat, tipo: x.tipo, enunciado: x.enunciado, imagen_url: x.imagen_url || null, opciones: x.opciones, clave: x.clave, explicacion: x.explicacion || null }))));
    toast(ps.length === 1 ? 'Pregunta guardada en su banco.' : `${ps.length} preguntas guardadas en su banco.`);
  } catch (er) { toast(errorMsg(er), 'error'); }
}
async function traerDelBanco() {
  const b = await q(sb.from('banco_doc').select('*').order('creado_en', { ascending: false }));
  if (!b.length) return toast('Su banco está vacío. Use «Guardar en mi banco» en cualquier pregunta.', 'error');
  const mats = [...new Set(b.map(x => x.materia || 'Sin materia'))];
  const w = modal({ icon: 'i-bank', titulo: 'Traer de mi banco', sub: `${b.length} preguntas guardadas`, ancho: true,
    cuerpo: `<div class="row"><input id="bq" placeholder="Buscar…" style="flex:1;min-width:160px;border:1.5px solid var(--line);border-radius:12px;padding:10px 12px;background:var(--surface-2)"><select id="bm" style="border:1.5px solid var(--line);border-radius:12px;padding:10px;background:var(--surface-2)"><option value="">Todas las materias</option>${mats.map(m => `<option>${esc(m)}</option>`).join('')}</select></div><div id="bl" style="display:grid;gap:8px;max-height:52vh;overflow:auto"></div>`,
    pie: `<button class="btn sec" type="button" data-cerrar>Cancelar</button><button class="btn pri" type="button" id="btraer">Agregar las marcadas</button>` });
  const pint = () => { const t = normal($('#bq').value), m = $('#bm').value;
    $('#bl').innerHTML = b.filter(x => (!m || (x.materia || 'Sin materia') === m) && (!t || normal(x.enunciado).includes(t))).map(x => `<label class="pend" style="cursor:pointer"><input type="checkbox" value="${x.id}"><span class="tx"><span class="row" style="gap:6px">${tipoTag(x.tipo)}<span class="xs muted">${esc(x.materia || 'Sin materia')}${x.usos ? ` · usada ${x.usos} ${x.usos === 1 ? 'vez' : 'veces'}` : ''}</span></span><span class="small">${esc(x.enunciado.slice(0, 180))}</span></span></label>`).join('') || '<p class="small muted">Nada coincide con la búsqueda.</p>'; };
  pint(); $('#bq').oninput = pint; $('#bm').onchange = pint;
  w.querySelector('#btraer').onclick = async () => {
    const sel = $$('#bl input:checked').map(i => b.find(x => x.id === i.value)); if (!sel.length) return toast('Marque al menos una pregunta.', 'error');
    sel.forEach(x => ED.ex.preguntas.push(desdeBanco(x)));
    cerrarModal(); ED.cambios = true; pintarEditor(); toast(`Se agregaron ${sel.length} preguntas.`);
    for (const x of sel) sb.from('banco_doc').update({ usos: (x.usos || 0) + 1 }).eq('id', x.id).then(() => { });
  };
}
const desdeBanco = x => { const p = { ...nuevaPregunta(x.tipo), enunciado: x.enunciado, imagen_url: x.imagen_url || '', explicacion: x.explicacion || '', opciones: JSON.parse(JSON.stringify(x.opciones)), clave: JSON.parse(JSON.stringify(x.clave)) };
  if (p.tipo === 'completar' && !(p.clave || []).length) p.clave = ['']; if (p.tipo === 'varias' && !Array.isArray(p.clave)) p.clave = []; return p; };

async function banco({ S, main, recargar }) {
  main.innerHTML = cargando();
  const b = await q(sb.from('banco_doc').select('*').order('creado_en', { ascending: false }));
  const mats = [...new Set(b.map(x => x.materia || 'Sin materia'))];
  let fm = '', ft = '';
  const pint = () => {
    const l = b.filter(x => (!fm || (x.materia || 'Sin materia') === fm) && (!ft || x.tipo === ft));
    $('#bl').innerHTML = l.length ? l.map(x => `<div class="card" style="gap:8px"><div class="row between"><span class="row" style="gap:6px">${tipoTag(x.tipo)}<span class="xs muted">${esc(x.materia || 'Sin materia')} · ${fecha(x.creado_en)}${x.usos ? ` · usada ${x.usos} ${x.usos === 1 ? 'vez' : 'veces'}` : ''}</span></span><button class="btn ghost sm" type="button" data-del="${x.id}" style="color:var(--bad)">Borrar</button></div>
      <p>${esc(x.enunciado)}</p>${x.imagen_url ? `<img class="thumbq" src="${esc(x.imagen_url)}" alt="Imagen">` : ''}${resumenClave(x)}</div>`).join('')
      : `<div class="card">${vacio('i-bank', b.length ? 'No hay preguntas con ese filtro' : 'Su banco está vacío', 'En el editor de exámenes, use «Guardar en mi banco» en cualquier pregunta. Solo usted ve su banco.')}</div>`;
  };
  main.innerHTML = `${head('Solo usted lo ve', 'Mi banco de preguntas', `<button class="btn pri" type="button" data-accion="nuevo">${ic('i-plus', 18)}Crear examen</button>`, { sub: `${b.length} ${b.length === 1 ? 'pregunta guardada' : 'preguntas guardadas'}. Úselas en cualquier examen con «Traer de mi banco».` })}
    <div class="card" style="padding:12px 16px"><div class="row"><select id="fm" aria-label="Materia" style="border:1.5px solid var(--line);border-radius:12px;padding:10px;background:var(--surface-2)"><option value="">Todas las materias</option>${mats.map(m => `<option>${esc(m)}</option>`).join('')}</select><select id="ft" aria-label="Tipo" style="border:1.5px solid var(--line);border-radius:12px;padding:10px;background:var(--surface-2)"><option value="">Todos los tipos</option>${Object.entries(TIPOS).map(([k, [t]]) => `<option value="${k}">${t}</option>`).join('')}</select></div></div>
    <div id="bl" style="display:grid;gap:12px"></div>${corp}`;
  pint();
  main.onchange = e => { if (e.target.id === 'fm') fm = e.target.value; if (e.target.id === 'ft') ft = e.target.value; pint(); };
  main.onclick = async e => { const id = e.target.closest('[data-del]')?.dataset.del; if (!id) return; if (!await confirmar({ titulo: '¿Borrar esta pregunta del banco?', texto: 'Los exámenes que ya la usan no cambian.', si: 'Borrar', peligro: true })) return;
    try { await q(sb.from('banco_doc').delete().eq('id', id)); toast('Pregunta borrada.'); recargar(); } catch (er) { toast(errorMsg(er), 'error'); } };
}
function resumenClave(x) {
  if (x.tipo === 'una' || x.tipo === 'varias') { const c = [].concat(x.clave || []); return `<div style="display:grid;gap:4px">${Object.entries(x.opciones || {}).map(([k, v]) => `<span class="small" style="${c.includes(k) ? 'color:var(--ok);font-weight:700' : 'color:var(--muted)'}">${k}. ${esc(v)}${c.includes(k) ? ' ✓' : ''}</span>`).join('')}</div>`; }
  if (x.tipo === 'vf') return `<span class="small" style="color:var(--ok);font-weight:700">Respuesta: ${x.clave === 'V' ? 'Verdadero' : 'Falso'}</span>`;
  if (x.tipo === 'completar') return `<span class="small" style="color:var(--ok);font-weight:700">Se acepta: ${(x.clave || []).map(esc).join(' / ')}</span>`;
  if (x.tipo === 'relacionar') return `<div class="small muted">${x.opciones.izq.map((a, i) => `${esc(a)} → ${esc(x.opciones.der[i])}`).join('<br>')}</div>`;
  if (x.tipo === 'ordenar') return `<div class="small muted">${x.opciones.pasos.map((s, i) => `${i + 1}. ${esc(s)}`).join('<br>')}</div>`;
  return '';
}

// ---------- Excel ----------
const CODIGOS = { 'una correcta': 'una', una: 'una', 'varias correctas': 'varias', varias: 'varias', 'falso o verdadero': 'vf', 'verdadero o falso': 'vf', vf: 'vf', completar: 'completar', relacionar: 'relacionar', ordenar: 'ordenar', 'ordenar pasos': 'ordenar' };
function plantillaExcel() {
  descargarExcel('plantilla-examen-fortalecer', { Preguntas: [
    ['Tipo', 'Pregunta', 'Opción A', 'Opción B', 'Opción C', 'Opción D', 'Opción E', 'Respuesta', 'Valor', 'Explicación'],
    ['Una correcta', '¿Cuánto es 3 × 4?', '7', '12', '34', '1', '', 'B', 1, 'Tres veces cuatro es doce'],
    ['Varias correctas', '¿Cuáles son números primos?', '2', '4', '5', '9', '', 'A,C', 1, ''],
    ['Falso o verdadero', 'El agua hierve a 100 °C al nivel del mar.', '', '', '', '', '', 'V', 1, ''],
    ['Completar', 'La capital de Colombia es ___.', '', '', '', '', '', 'Bogotá / Bogotá D.C.', 1, 'Separe con / las formas aceptadas'],
    ['Relacionar', 'Relacione cada animal con su grupo.', 'Perro = Mamífero', 'Águila = Ave', 'Sapo = Anfibio', '', '', '', 2, 'En cada opción: concepto = pareja'],
    ['Ordenar', 'Ordene los pasos del método científico.', 'Observar', 'Preguntar', 'Formular hipótesis', 'Experimentar', 'Concluir', '', 2, 'Escriba los pasos en el orden correcto'],
  ] });
}
function importarExcel() {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.xlsx,.xls,.csv';
  inp.onchange = async () => {
    const f = inp.files[0]; if (!f) return;
    try {
      const filas = (await leerExcel(f)).slice(1).filter(r => r.some(c => String(c).trim()));
      const nuevas = [], errores = [];
      filas.forEach((r, n) => {
        const tipo = CODIGOS[normal(r[0])]; const fila = n + 2;
        if (!tipo) return errores.push(`Fila ${fila}: tipo «${r[0]}» no reconocido`);
        const p = nuevaPregunta(tipo); p.enunciado = String(r[1] || '').trim(); p.valor = Number(String(r[8]).replace(',', '.')) || 1; p.explicacion = String(r[9] || '').trim();
        const ops = r.slice(2, 7).map(x => String(x).trim()), resp = String(r[7] || '').trim();
        if (tipo === 'una' || tipo === 'varias') { p.opciones = {}; ops.filter(Boolean).forEach((v, i) => p.opciones[LETRAS[i]] = v); const ks = resp.toUpperCase().split(/[,;\s]+/).filter(k => p.opciones[k]); p.clave = tipo === 'una' ? (ks[0] || '') : ks; }
        if (tipo === 'vf') p.clave = /^(v|verdadero|true|si|sí)$/i.test(resp) ? 'V' : /^(f|falso|false|no)$/i.test(resp) ? 'F' : '';
        if (tipo === 'completar') p.clave = resp.split('/').map(s => s.trim()).filter(Boolean);
        if (tipo === 'relacionar') { const pares = ops.filter(Boolean).map(s => s.split('=').map(z => z.trim())); p.opciones = { izq: pares.map(z => z[0] || ''), der: pares.map(z => z[1] || '') }; }
        if (tipo === 'ordenar') p.opciones = { pasos: ops.filter(Boolean) };
        const fl = faltaEn(p); if (fl) errores.push(`Fila ${fila}: ${fl.toLowerCase()}`);
        if (tipo === 'completar' && !p.clave.length) p.clave = [''];
        nuevas.push(p);
      });
      if (!nuevas.length) return toast('El archivo no tiene preguntas. Use la plantilla.', 'error');
      ED.ex.preguntas.push(...nuevas); ED.cambios = true; pintarEditor();
      if (errores.length) modal({ icon: 'i-warn', tono: 'warn', titulo: `Se cargaron ${nuevas.length} preguntas`, cuerpo: `<p>Revise estas antes de guardar (aparecen marcadas en el examen):</p><ul class="small">${errores.slice(0, 12).map(x => `<li>${esc(x)}</li>`).join('')}</ul>`, pie: '<button class="btn pri" type="button" data-cerrar>Entendido</button>' });
      else toast(`Se cargaron ${nuevas.length} preguntas.`);
    } catch (er) { toast(errorMsg(er), 'error'); }
  };
  inp.click();
}

// ---------- Resultados y sala en vivo ----------
const EST = { respondiendo: ['Respondiendo', 'p-ok'], sin_conexion: ['Sin conexión', 'p-warn'], entrego: ['Entregó', 'p-brand'], sospecha: ['Sospecha', 'p-bad'], no_presento: ['No presentó', 'p-mute'], sin_empezar: ['Sin empezar', 'p-info'], programado: ['Programado', 'p-mute'] };
let salaTimer = null;
export async function resultadosEx({ S, main, params, go }, volverA = 'examenes', volverTxt = 'Mis exámenes') {
  clearInterval(salaTimer);
  main.innerHTML = cargando();
  let R = await rpc('doc_resultados', { p_examen: params[0] });
  let vista = 'sala', fg = '';
  const pintar = () => {
    const e = R.examen, es = R.escala, d = es.decimales, L = R.estudiantes.filter(x => !fg || x.grupo_id === fg);
    const ent = L.filter(x => x.nota != null), prom = ent.length ? ent.reduce((s, x) => s + Number(x.nota), 0) / ent.length : null;
    const apr = ent.filter(x => Number(x.nota) >= Number(es.aprobar)).length, resp = L.filter(x => x.estado === 'respondiendo' || x.estado === 'sin_conexion').length, sos = L.filter(x => x.estado === 'sospecha').length;
    const abierto = e.grupos.some(g => new Date(g.apertura) <= Date.now() && new Date(g.fin) > Date.now());
    const grupos = [...new Map(R.estudiantes.map(x => [x.grupo_id, x.grupo])).entries()];
    const tabla = L.length ? `<div class="tw"><table><thead><tr><th>Estudiante</th><th>Grupo</th><th>Estado</th><th class="r">Respondidas</th><th class="r">Advertencias</th><th class="r">Nota</th><th></th></tr></thead><tbody>${L.map(x => `<tr><td><b>${esc(x.nombre)}</b></td><td>${esc(x.grupo)}</td><td>${pill(...EST[x.estado])}${x.minutos_extra ? ` <span class="xs muted">+${x.minutos_extra} min</span>` : ''}</td><td class="r num">${x.respondidas}</td><td class="r num" style="${x.advertencias ? 'color:var(--warn);font-weight:800' : ''}">${x.advertencias}</td><td class="r">${notaHTML(x.nota, es)}${e.intentos > 1 && x.usados ? `<br><span class="xs muted">${x.usados} de ${e.intentos} intentos</span>` : ''}</td><td><button class="btn ghost sm" type="button" data-est="${x.id}">Ver</button></td></tr>`).join('')}</tbody></table></div>` : vacio('i-users', 'No hay estudiantes en los grupos de este examen');
    const porPregunta = R.preguntas.map(p => `<div class="pend" style="align-items:flex-start"><div class="cnt"><b style="color:${p.promedio == null ? 'var(--muted)' : p.promedio < 50 ? 'var(--bad)' : p.promedio < 70 ? 'var(--warn)' : 'var(--ok)'}">${p.promedio ?? '—'}${p.promedio != null ? '%' : ''}</b><span>de acierto</span></div><div class="tx"><span class="row" style="gap:6px"><b>Pregunta ${p.n}</b>${tipoTag(p.tipo)}</span><span class="small">${esc(String(p.enunciado).slice(0, 220))}</span>${p.error_comun ? `<span class="xs" style="color:var(--bad)">Respuesta equivocada más común: «${esc(p.error_comun)}»</span>` : ''}</div></div>`).join('');
    main.innerHTML = `${head(`${esc(e.materia || 'Sin materia')}${e.es_taller ? ' · taller' : ''}`, esc(e.titulo), `${abierto ? '<span class="chipe">En vivo · se actualiza solo</span>' : ''}<button class="btn sec" type="button" data-xls>${ic('i-down', 18)}Descargar Excel</button>`, { volver: volverBtn(volverA, volverTxt), sub: e.grupos.map(g => `Grupo ${esc(g.nombre)}: ${fechaHora(g.apertura)} a ${fechaHora(g.fin)}`).join(' · ') })}
      <div class="grid g4">
        <div class="card tile2"><span class="lbl">Entregaron</span><span class="v"><span data-contar="${ent.length}">${ent.length}</span><span class="muted" style="font-size:20px"> / ${L.length}</span></span>${resp ? `<span class="xs" style="color:var(--ok);font-weight:700">${resp} respondiendo ahora</span>` : ''}</div>
        <div class="card tile2"><span class="lbl">Promedio</span><span class="v" style="color:var(--${prom == null ? 'muted' : notaCls(prom, es)})">${prom == null ? '—' : `<span data-contar="${prom.toFixed(d)}" data-dec="${d}">${notaTxt(prom, d)}</span>`}</span><span class="xs muted">de ${notaTxt(es.min, d)} a ${notaTxt(es.max, d)}</span></div>
        <div class="card tile2" style="--tc:var(--ok)"><span class="lbl">Aprobaron</span><span class="v"><span data-contar="${apr}">${apr}</span></span><span class="xs muted">con ${notaTxt(es.aprobar, d)} o más</span></div>
        <div class="card tile2" style="--tc:var(--bad)"><span class="lbl">Sospechas</span><span class="v" style="${sos ? 'color:var(--bad)' : ''}">${sos}</span><span class="xs muted">${e.antifraude ? 'cerrados por salir de la ventana' : 'el control contra la copia está apagado'}</span></div>
      </div>
      <div class="card"><div class="row between"><div class="seg2" role="group" aria-label="Vista">${[['sala', 'Estudiantes'], ['preguntas', 'Pregunta por pregunta']].map(([k, t]) => `<button type="button" data-vista="${k}" aria-pressed="${vista === k}">${t}</button>`).join('')}</div>${grupos.length > 1 ? `<select id="fg" aria-label="Grupo" style="border:1.5px solid var(--line);border-radius:12px;padding:9px;background:var(--surface-2)"><option value="">Todos los grupos</option>${grupos.map(([id, n]) => `<option value="${id}" ${fg === id ? 'selected' : ''}>Grupo ${esc(n)}</option>`).join('')}</select>` : ''}</div>
        ${vista === 'sala' ? tabla : `<p class="small muted">Las preguntas con menos aciertos son las que conviene repasar en clase.</p><div style="display:grid;gap:10px">${porPregunta}</div>`}</div>${corp}`;
    document.dispatchEvent(new Event('f-pintado'));
  };
  pintar();
  const recargarDatos = async () => { if (!document.body.contains(main) || !location.hash.includes(params[0])) return clearInterval(salaTimer); if ($('#modalbox').innerHTML) return; try { R = await rpc('doc_resultados', { p_examen: params[0] }); pintar(); } catch { } };
  if (R.examen.grupos.some(g => new Date(g.apertura) <= Date.now() + 3600000 && new Date(g.fin) > Date.now())) salaTimer = setInterval(recargarDatos, 20000);
  main.onchange = e => { if (e.target.id === 'fg') { fg = e.target.value; pintar(); } };
  main.onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.vista) { vista = b.dataset.vista; pintar(); }
    if ('xls' in b.dataset) {
      const es = R.escala;
      descargarExcel(`notas-${R.examen.titulo}`, { Notas: [['Estudiante', 'Documento', 'Grupo', 'Estado', 'Respondidas', 'Advertencias', 'Nota'], ...R.estudiantes.map(x => [x.nombre, x.documento || '', x.grupo, EST[x.estado][0], x.respondidas, x.advertencias, x.nota == null ? '' : Number(x.nota)])],
        Preguntas: [['N.º', 'Tipo', 'Pregunta', '% de acierto', 'Error más común'], ...R.preguntas.map(p => [p.n, TIPOS[p.tipo][0], p.enunciado, p.promedio ?? '', p.error_comun || ''])] });
    }
    if (b.dataset.est) detalleEstudiante(R, b.dataset.est, recargarDatos);
  };
}
function detalleEstudiante(R, id, alCambiar) {
  const x = R.estudiantes.find(y => y.id === id), e = R.examen;
  const puedeTiempo = ['respondiendo', 'sin_conexion', 'sin_empezar', 'no_presento', 'programado'].includes(x.estado);
  const puedeHab = ['entrego', 'sospecha'].includes(x.estado);
  const w = modal({ icon: 'i-user', titulo: esc(x.nombre), sub: `Grupo ${esc(x.grupo)} · ${EST[x.estado][0]}`,
    cuerpo: `${x.sospecha ? `<div class="alert a-warn">${ic('i-warn')}<div><b>Examen cerrado por sospecha</b>${esc(x.motivo || '')}</div></div>` : ''}
      <div class="grid g3" style="gap:10px"><div class="pend"><div class="tx"><span class="xs muted">Nota</span>${notaHTML(x.nota, R.escala)}</div></div><div class="pend"><div class="tx"><span class="xs muted">Respondidas</span><b>${x.respondidas}</b></div></div><div class="pend"><div class="tx"><span class="xs muted">Reingresos</span><b>${x.reingresos}</b></div></div></div>
      ${x.incidentes.length ? `<div><span class="lbl">Lo que registró el sistema</span><div style="display:grid;gap:4px;margin-top:6px">${x.incidentes.map(i => `<span class="small">${hora(i.hora)} · ${esc(i.tipo)}${i.cuenta ? ' <b style="color:var(--warn)">(advertencia)</b>' : ''}</span>`).join('')}</div></div>` : '<p class="small muted">No hay incidentes registrados.</p>'}
      ${puedeTiempo ? `<div class="field"><label for="mx">Darle más tiempo</label><select id="mx">${[5, 10, 15, 20, 30, 45, 60].map(m => `<option value="${m}">${m} minutos más</option>`).join('')}</select><span class="hint">${x.estado === 'no_presento' || x.estado === 'sin_empezar' ? 'Sirve aunque no haya alcanzado a entrar: podrá presentarlo dentro de ese tiempo.' : 'Conserva sus respuestas.'}</span></div>` : ''}`,
    pie: `<button class="btn sec" type="button" data-cerrar>Cerrar</button>${puedeHab ? `<button class="btn sec" type="button" id="hab">Habilitar de nuevo</button>` : ''}${puedeTiempo ? `<button class="btn pri" type="button" id="dart">Dar tiempo</button>` : ''}` });
  w.querySelector('#dart')?.addEventListener('click', async () => { try { await rpc('doc_dar_tiempo', { p_examen: e.id, p_estudiante: id, p_minutos: +$('#mx').value }); cerrarModal(); toast('Listo. Se le dio más tiempo.'); alCambiar(); } catch (er) { toast(errorMsg(er), 'error'); } });
  w.querySelector('#hab')?.addEventListener('click', async () => {
    cerrarModal();
    if (!await confirmar({ titulo: '¿Habilitar de nuevo el examen?', texto: `${esc(x.nombre)} podrá seguir respondiendo con lo que ya tenía. Su nota actual se borra hasta que vuelva a entregar.`, si: 'Sí, habilitar' })) return;
    try { await rpc('doc_habilitar', { p_examen: e.id, p_estudiante: id }); toast('Habilitado. Ya puede volver a entrar.'); alCambiar(); } catch (er) { toast(errorMsg(er), 'error'); }
  });
}

// ---------- Notas de mis grupos ----------
export async function notasGrupoHTML(main, grupoId, periodoId, { titulo = 'Notas', volver = '', grupos = [], periodos = [], alCambiar }) {
  const N = await rpc('notas_grupo', { p_grupo: grupoId, p_periodo: periodoId || null });
  const es = N.escala, d = es.decimales;
  const mats = N.materias.sort((a, b) => a.nombre.localeCompare(b.nombre));
  const promE = s => { const v = Object.values(s.notas).map(Number); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  const filas = N.estudiantes.map(s => `<tr><td><b>${esc(s.nombre)}</b></td>${mats.map(m => `<td class="r">${notaHTML(s.notas[m.id], es)}</td>`).join('')}<td class="r">${notaHTML(promE(s), es)}</td></tr>`).join('');
  main.innerHTML = `${head(N.periodo ? `${esc(N.periodo.nombre)} ${N.periodo.anio}` : 'Todo el año', `${titulo} · Grupo ${esc(N.grupo.nombre)}`,
    `${grupos.length > 1 ? `<div class="field"><label for="ng">Grupo</label><select id="ng">${grupos.map(g => `<option value="${g.id}" ${g.id === grupoId ? 'selected' : ''}>Grupo ${g.grado}-${esc(g.nombre)}</option>`).join('')}</select></div>` : ''}${periodos.length ? `<div class="field"><label for="np">Período</label><select id="np">${periodos.map(p => `<option value="${p.id}" ${p.id === (periodoId || N.periodo?.id) ? 'selected' : ''}>${esc(p.nombre)} ${p.anio}</option>`).join('')}</select></div>` : ''}<button class="btn sec" type="button" data-xls>${ic('i-down', 18)}Excel</button>`, { volver })}
    <div class="card">${N.estudiantes.length && mats.length ? `<div class="tw"><table><thead><tr><th>Estudiante</th>${mats.map(m => `<th class="r">${esc(m.nombre)}</th>`).join('')}<th class="r">Promedio</th></tr></thead><tbody>${filas}</tbody></table></div>
      <p class="xs muted">Promedio de los exámenes de cada materia en el período. Quien no presentó un examen ya cerrado tiene ${notaTxt(es.min, d)} en ese examen. Los talleres no cuentan.</p>`
      : vacio('i-list', 'Aún no hay notas en este período', N.estudiantes.length ? 'Las notas aparecen cuando se programan exámenes para el grupo.' : 'El grupo no tiene estudiantes.')}</div>
    ${N.examenes.length ? `<div class="card"><span class="lbl">Exámenes del período</span><div class="tw"><table><thead><tr><th>Estudiante</th>${N.examenes.map(x => `<th class="r" title="${esc(x.titulo)}">${esc(x.titulo.slice(0, 18))}</th>`).join('')}</tr></thead><tbody>${N.estudiantes.map(s => `<tr><td>${esc(s.nombre)}</td>${N.examenes.map(x => `<td class="r">${notaHTML(s.examenes[x.id], es)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>` : ''}${corp}`;
  main.onchange = ev => { if (ev.target.id === 'ng' || ev.target.id === 'np') alCambiar($('#ng')?.value || grupoId, $('#np')?.value || periodoId); };
  main.onclick = ev => { if (ev.target.closest('[data-xls]')) descargarExcel(`notas-grupo-${N.grupo.nombre}`, { Notas: [['Estudiante', 'Documento', ...mats.map(m => m.nombre), 'Promedio'], ...N.estudiantes.map(s => [s.nombre, s.documento || '', ...mats.map(m => s.notas[m.id] ?? ''), promE(s) == null ? '' : +promE(s).toFixed(d)])] }); };
}
async function notas({ S, main, params, go }) {
  main.innerHTML = cargando();
  const [{ grupos }, pers] = await Promise.all([misGrupos(S), q(sb.from('periodos').select('*').order('inicio'))]);
  if (!grupos.length) { main.innerHTML = `${head('Docente', 'Mis grupos')}<div class="card">${vacio('i-users', 'Aún no tiene grupos', 'Pida a la coordinación que le asigne sus materias.')}</div>${corp}`; return; }
  const g = params[0] && grupos.some(x => x.id === params[0]) ? params[0] : grupos[0].id;
  const per = params[1] || S.periodo?.id || '';
  await notasGrupoHTML(main, g, per, { titulo: 'Notas', grupos, periodos: pers, alCambiar: (a, b) => go(`notas/${a}/${b || ''}`) });
}

// ---------- Reportes ICFES (simulacros) ----------
async function reportesIcfes({ S, main, params, go }) {
  const area = S.perfil.area;
  if (params[0]) return reporteAplicacion(main, params[0], { rol: 'docente', areaDocente: area, volver: volverBtn('reportes', 'Resultados ICFES') });
  main.innerHTML = cargando();
  const { grupos } = await misGrupos(S);
  const ids = grupos.map(g => g.id);
  const apls = ids.length ? await q(sb.from('aplicaciones').select('*').in('grupo_id', ids).order('inicio', { ascending: false })) : [];
  const g911 = grupos.filter(g => g.grado >= 9);
  main.innerHTML = `${head(area != null ? AREAS[area] : 'Simulacros', 'Resultados ICFES', '', { sub: 'Elija un simulacro terminado para ver los resultados de su grupo, pregunta por pregunta, con sugerencias para la clase.' })}
    <div class="card">${apls.length ? listaAplicaciones(apls, grupos) : vacio('i-results', 'Aún no hay simulacros', g911.length ? 'Cuando la coordinación programe un simulacro para sus grupos, aparecerá aquí.' : 'Los simulacros ICFES son para los grados 9.º, 10.º y 11.º.')}</div>
    ${g911.length ? `<div class="card"><div class="row between"><div><span class="lbl">Evolución</span><h2>¿Cómo van mis grupos?</h2></div><select id="evg" aria-label="Grupo" style="border:1.5px solid var(--line);border-radius:12px;padding:9px;background:var(--surface-2)">${g911.map(x => `<option value="${x.id}">Grupo ${x.grado}-${esc(x.nombre)}</option>`).join('')}</select></div><div id="evo">${cargando()}</div></div>` : ''}${corp}`;
  const evo = async () => { const el = $('#evo'); if (!el) return; el.innerHTML = cargando(); try { el.innerHTML = evolucionHTML(await rpc('evolucion_grupo', { p_grupo: $('#evg').value })); } catch (e) { el.innerHTML = `<p class="small muted">${esc(errorMsg(e))}</p>`; } };
  evo();
  main.onchange = e => { if (e.target.id === 'evg') evo(); };
  main.onclick = e => { const b = e.target.closest('[data-rep]'); if (b) go('reportes/' + b.dataset.rep); };
}

async function perfil({ S, main }) {
  const p = S.perfil;
  main.innerHTML = `${head('Mi cuenta', 'Perfil')}<div class="card" style="max-width:560px"><div class="row" style="gap:16px"><span class="av" style="width:64px;height:64px;font-size:20px;border-radius:18px">${esc(iniciales(p.nombres + ' ' + p.apellidos))}</span><div><b style="font-size:19px">${esc(p.nombres)} ${esc(p.apellidos)}</b><br><span class="muted small">${esc(p.email || '')}</span></div></div>
    <div class="row"><button class="btn sec" type="button" data-cambiar-clave>${ic('i-key')}Cambiar contraseña</button><button class="btn ghost" type="button" data-salir>${ic('i-exit')}Cerrar sesión</button></div></div>${corp}`;
}
