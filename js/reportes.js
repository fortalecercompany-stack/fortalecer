// FORTALECER · reportes compartidos (coordinador, docente, administrador)
import { $, esc, ic, AREAS, SHORT, col, soft, aico, toast, errorMsg, head, kpi, cargando, vacio, corp, rings5, lvlTag, nivel, nivelNombre, CORTES, lvLegend, heat, barra, fecha, fechaHora, hora, descargarCSV, descargarExcel, descargarWord, imprimir, globalDe, escudo } from './lib.js';
import { rpc } from './api.js';

// Sugerencias pedagógicas por área y competencia (marcos de referencia del ICFES)
const SUG = {
  0: { 'identificar': 'Trabajar la ubicación de información explícita: preguntas de «¿quién, qué, cuándo?» con subrayado en textos cortos.',
       'comprender': 'Pedir que expliquen con sus palabras cómo se relacionan las partes del texto y qué función cumple cada párrafo.',
       'reflexionar': 'Discutir la intención del autor, contrastar dos fuentes y evaluar si los argumentos son sólidos.',
       '': 'Leer a diario textos continuos y discontinuos (infografías, tablas) y conversar sobre su propósito.' },
  1: { 'interpret': 'Leer tablas y gráficas reales (precios, clima, encuestas) y convertir la información de un formato a otro.',
       'formula': 'Antes de calcular, pedir que escriban el plan: datos, qué se busca y pasos. Practicar problemas de varios pasos.',
       'argument': 'Presentar soluciones con un error y pedir que lo encuentren y expliquen «es correcto porque…».',
       '': 'Resolver problemas contextualizados y justificar cada respuesta.' },
  2: { 'pensamiento social': 'Relacionar conceptos de la Constitución y de ciencias sociales con casos del municipio.',
       'perspectiv': 'Leer un mismo hecho desde varios actores y pedir que identifiquen intereses y puntos de vista.',
       'reflexiv': 'Analizar consecuencias de decisiones y proponer alternativas para un problema social real.',
       '': 'Trabajar con fuentes: ¿quién lo dice, con qué interés y con qué evidencia?' },
  3: { 'uso comprensivo': 'Relacionar fenómenos cotidianos con conceptos científicos usando modelos y dibujos.',
       'explicación': 'Pedir explicaciones causales («esto ocurre porque…») y construir modelos de fenómenos.',
       'indagación': 'Diseñar pequeños experimentos: variables, predicciones y lectura de resultados en gráficas.',
       '': 'Conectar biología, química y física con situaciones del entorno rural.' },
  4: { '': 'Practicar lectura corta en inglés, vocabulario de uso diario y gramática en contexto (tiempos verbales, preposiciones).' },
};
const sugerencia = (area, comp) => { const s = SUG[area] || {}; const c = String(comp || '').toLowerCase(); const k = Object.keys(s).find(k => k && c.includes(k)); return s[k ?? ''] || s['']; };

export async function reporteAplicacion(main, aplicacionId, { rol, areaDocente = null, volver = '' }) {
  main.innerHTML = cargando('Calculando el reporte…');
  let rep, an;
  try { [rep, an] = await Promise.all([rpc('reporte_aplicacion', { p_aplicacion: aplicacionId }), rpc('analisis_preguntas', { p_aplicacion: aplicacionId })]); }
  catch (e) { main.innerHTML = `${volver}<div class="card"><div class="alert a-warn">${ic('i-clock')}<div><b>Reporte no disponible todavía</b>${esc(errorMsg(e))}</div></div></div>`; return; }
  const A = rep.aplicacion, est = rep.estudiantes, pres = est.filter(e => e.presento);
  const parcial = !!rep.parcial;
  const verSalidas = rol !== 'docente' && est.some(e => e.salidas > 0);
  const enCurso = est.filter(e => e.estado === 'respondiendo').length, sinEmpezar = est.filter(e => e.estado === 'sin_empezar').length;
  const estadoPill = e => e.estado === 'respondiendo' ? '<span class="pill p-info">Respondiendo</span>' : parcial && e.estado === 'sin_empezar' ? '<span class="pill p-mute">Sin empezar</span>' : '<span class="pill p-mute">No presentó</span>';
  const salidasTd = e => verSalidas ? `<td class="r">${e.salidas ? `<span class="pill ${e.salidas >= 3 ? 'p-warn' : 'p-mute'}" title="Veces que salió de la ventana del simulacro">${e.salidas}</span>` : '<span class="muted">0</span>'}</td>` : '';
  const areaVal = (e, i) => (e.areas || []).find(x => x.area === i)?.puntaje ?? null;
  const prom = [0, 1, 2, 3, 4].map(i => pres.length ? Math.round(pres.reduce((s, e) => s + (areaVal(e, i) || 0), 0) / pres.length) : 0);
  const promG = pres.length ? Math.round(pres.reduce((s, e) => s + e.global, 0) / pres.length) : 0;
  const orden = [...pres].sort((a, b) => b.global - a.global);
  const puesto = id => orden.findIndex(e => e.id === id) + 1;
  const dist = i => { const d = [0, 0, 0, 0]; pres.forEach(e => d[nivel(i, areaVal(e, i) || 0) - 1]++); return d; };
  const stack = d => { const t = d.reduce((a, b) => a + b, 0) || 1; return `<div class="stack">${d.map((v, i) => v ? `<i class="l${i + 1}" style="flex:${v}" title="Nivel ${i + 1}: ${v}">${v}</i>` : '').join('')}</div>`; };
  const areasVer = areaDocente == null ? [0, 1, 2, 3, 4] : [areaDocente];

  // Análisis por pregunta y por competencia
  const anV = an.filter(x => areasVer.includes(x.area));
  const pct = x => x.presentaron ? Math.round(100 * x.aciertos / x.presentaron) : 0;
  const porComp = {};
  anV.forEach(x => { const k = x.area + '|' + (x.competencia || 'General'); (porComp[k] ||= { area: x.area, comp: x.competencia || 'General', a: 0, t: 0 }); porComp[k].a += x.aciertos; porComp[k].t += x.presentaron; });
  const comps = Object.values(porComp).map(c => ({ ...c, p: c.t ? Math.round(100 * c.a / c.t) : 0 })).sort((a, b) => a.p - b.p);

  const filas = orden.concat(est.filter(e => !e.presento)).map(e => `<tr><td class="num">${e.presento ? puesto(e.id) : '—'}</td><td><b class="small">${esc(e.nombre)}</b><div class="xs muted">${esc(e.documento || '')}</div></td>${areasVer.map(i => `<td class="r num">${e.presento ? (areaVal(e, i) ?? '—') : '—'}</td>`).join('')}${areaDocente == null ? `<td class="r num"><b>${e.presento ? e.global : '—'}</b></td>` : ''}${salidasTd(e)}<td class="r">${e.presento ? `<button class="btn ghost sm" type="button" data-boletin="${e.id}" style="color:var(--brand)">Boletín</button>` : estadoPill(e)}</td></tr>`).join('');

  // Cuadro de honor, estudiantes en riesgo y cerca de subir de nivel
  const areasN = areaDocente == null ? [0, 1, 2, 3, 4] : [areaDocente];
  const honor = orden.slice(0, 5);
  const riesgo = pres.filter(e => { const n1 = areasN.filter(i => nivel(i, areaVal(e, i) || 0) === 1).length; return areaDocente == null ? n1 >= 2 : n1 >= 1; });
  const cerca = [];
  pres.forEach(e => areasN.forEach(i => { const v = areaVal(e, i) || 0, n = nivel(i, v); if (n < 4) { const falta = CORTES[i][n - 1] + 1 - v; if (falta > 0 && falta <= 5) cerca.push({ e, i, falta, sig: nivelNombre(i, n + 1) }); } }));
  cerca.sort((a, b) => a.falta - b.falta);
  const listaMini = (arr, fn, vacioTxt) => arr.length ? `<ol class="mini">${arr.map(fn).join('')}</ol>` : `<p class="small muted">${vacioTxt}</p>`;
  const tarjetasSeguimiento = pres.length ? `<div class="grid g3">
      <div class="card"><div><span class="lbl">${ic('i-up', 14)} Cuadro de honor</span><h3>Mejores puntajes</h3></div>${listaMini(honor, e => `<li><span>${esc(e.nombre)}</span><b class="num">${areaDocente == null ? e.global : areaVal(e, areaDocente)}</b></li>`, 'Sin datos.')}</div>
      <div class="card"><div><span class="lbl" style="color:var(--bad)">${ic('i-warn', 14)} En riesgo</span><h3>${areaDocente == null ? 'Nivel 1 en dos o más áreas' : 'En nivel 1'}</h3></div>${listaMini(riesgo.slice(0, 12), e => `<li><span>${esc(e.nombre)}</span><span class="xs muted">${areasN.filter(i => nivel(i, areaVal(e, i) || 0) === 1).map(i => SHORT[i]).join(', ')}</span></li>`, 'Nadie está en riesgo. ¡Muy bien!')}${riesgo.length > 12 ? `<p class="xs muted">y ${riesgo.length - 12} más (ver Excel).</p>` : ''}</div>
      <div class="card"><div><span class="lbl" style="color:var(--ok)">${ic('i-bulb', 14)} Cerca de subir</span><h3>A 5 puntos o menos del siguiente nivel</h3></div>${listaMini(cerca.slice(0, 12), c => `<li><span>${esc(c.e.nombre)}</span><span class="xs muted">${SHORT[c.i]}: faltan ${c.falta} para ${c.sig}</span></li>`, 'Nadie está a 5 puntos de subir.')}</div>
    </div>` : '';
  const aviso = parcial ? `<div class="alert a-info">${ic('i-clock')}<div><b>Reporte de avance · el simulacro sigue abierto</b>Incluye a los ${pres.length} estudiantes que ya entregaron. ${enCurso} siguen respondiendo${sinEmpezar ? ` y ${sinEmpezar} no han empezado` : ''}. El reporte final estará listo cuando termine el tiempo (${fechaHora(A.fin)}). <button class="linkbtn" type="button" data-refrescar>Actualizar ahora</button></div></div>` : `<div class="alert a-ok">${ic('i-sync')}<div><b>Reporte final</b>El tiempo del simulacro terminó. Estos son los resultados definitivos del grupo.</div></div>`;

  main.innerHTML = `${volver}${head(`${esc(A.colegio.nombre)} · grupo ${esc(A.grupo)}`, `${esc(A.simulacro)}${areaDocente != null ? ' · ' + AREAS[areaDocente] : ''}`, `<div class="row">
      <button class="btn pri" type="button" data-bol-todos>${ic('i-down', 16)}Boletines del grupo</button>
      <button class="btn sec sm" type="button" data-dl="xlsx">${ic('i-down', 15)}Excel</button><button class="btn sec sm" type="button" data-dl="csv">${ic('i-down', 15)}CSV</button><button class="btn sec sm" type="button" data-dl="doc">${ic('i-down', 15)}Word</button><button class="btn sec sm" type="button" data-dl="pdf">${ic('i-down', 15)}PDF</button></div>`)}
    <p class="small muted">Aplicado el ${fechaHora(A.inicio)} · ${parcial ? 'termina' : 'terminó'} ${fechaHora(A.fin)}</p>
    ${aviso}
    <div class="grid g4">${areaDocente == null ? kpi('i-results', 'var(--brand)', 'var(--brand-soft)', promG, 'promedio global') : kpi('i-results', col(areaDocente), soft(areaDocente), prom[areaDocente], 'promedio en ' + SHORT[areaDocente])}${kpi('i-users', 'var(--a3)', 'var(--a3s)', `${pres.length} / ${est.length}`, 'presentaron')}${kpi('i-warn', 'var(--warn)', 'var(--warn-soft)', !pres.length ? '—' : areaDocente == null ? SHORT[prom.indexOf(Math.min(...prom))] : (comps[0]?.p ?? 0) + '%', areaDocente == null ? 'área más baja' : 'competencia más baja')}${kpi('i-up', 'var(--ok)', 'var(--ok-soft)', orden[0]?.global ?? '—', 'mejor puntaje global')}</div>
    ${pres.length ? `<div class="bento">
      <div class="card w6"><div><span class="lbl">Promedio de 0 a 100</span><h2>Por área</h2></div><div style="display:grid;gap:14px">${areasVer.map(i => `<div style="display:grid;grid-template-columns:120px minmax(0,1fr) 36px;gap:10px;align-items:center"><span class="row" style="gap:8px;flex-wrap:nowrap">${aico(i, 28)}<b class="small">${SHORT[i]}</b></span>${barra(prom[i], col(i))}<b class="num" style="text-align:right">${prom[i]}</b></div>`).join('')}</div></div>
      <div class="card w6"><div class="row between"><div><span class="lbl">Niveles de desempeño</span><h2>Estudiantes por nivel</h2></div>${lvLegend}</div><div class="tw"><table><tbody>${areasVer.map(i => `<tr><td><div class="row" style="gap:10px;flex-wrap:nowrap">${aico(i, 28)}<b class="small">${SHORT[i]}</b></div></td><td style="min-width:200px">${stack(dist(i))}</td></tr>`).join('')}</tbody></table></div></div>
      <div class="card w12"><div class="row between"><div><span class="lbl">Mapa de calor · % de aciertos por pregunta</span><h2>Preguntas que más costaron</h2></div>${lvLegend}</div>
        ${heat(areasVer.map(i => SHORT[i]), Array.from({ length: 25 }, (_, j) => j + 1), (i, j) => { const x = anV.find(z => z.area === areasVer[i] && z.pos === areasVer[i] * 25 + j + 1); return x ? pct(x) : null; })}
        <p class="xs muted">Cada casilla es una pregunta del área (1 a 25). Pase el mouse para ver el detalle.</p></div>
      <div class="card w12" style="background:linear-gradient(160deg,var(--surface) 40%,var(--coral-soft))"><div class="row" style="gap:12px"><span class="aico" style="background:var(--coral-soft);color:var(--coral-ink)">${ic('i-bulb', 22)}</span><div><span class="lbl" style="color:var(--coral-ink)">Cierre del reporte</span><h2>Lo que el grupo necesita reforzar</h2></div></div>
        <div class="grid g3">${comps.slice(0, 3).map((c, k) => `<div class="card sugg" style="box-shadow:none"><span class="pill ${k === 0 ? 'p-bad' : k === 1 ? 'p-warn' : 'p-info'}" style="justify-self:start">${k === 0 ? 'Prioridad alta' : k === 1 ? 'Prioridad media' : 'Reforzar'}</span><b>${SHORT[c.area]} · ${esc(c.comp)} · ${c.p}%</b><p class="small">${esc(sugerencia(c.area, c.comp))}</p></div>`).join('')}</div>
        <p class="xs muted">Sugerencias basadas en los marcos de referencia del ICFES.</p></div>
    </div>${tarjetasSeguimiento}` : `<div class="card">${parcial ? vacio('i-clock', 'Todavía nadie ha entregado', 'Cuando los primeros estudiantes entreguen, aquí verá su avance. Pulse «Actualizar ahora» en unos minutos.') : vacio('i-users', 'Nadie presentó este simulacro', 'Cuando los estudiantes lo presenten, aquí verá los resultados.')}</div>`}
    <div class="card"><div class="row between"><div><span class="lbl">Estudiantes</span><h2>Resultados individuales</h2></div><span class="xs muted">Ordenados por puesto</span></div>
      <div class="tw"><table><thead><tr><th>#</th><th>Estudiante</th>${areasVer.map(i => `<th class="r">${SHORT[i]}</th>`).join('')}${areaDocente == null ? '<th class="r">Global</th>' : ''}${verSalidas ? '<th class="r" title="Veces que salió de la ventana del simulacro">Salidas</th>' : ''}<th></th></tr></thead><tbody>${filas}</tbody></table></div></div>
    ${areaDocente == null || true ? `<div class="card"><div><span class="lbl">Análisis por pregunta</span><h2>Aciertos y error más común</h2></div><div class="tw" style="max-height:420px"><table><thead><tr><th>Pregunta</th><th>Área</th><th>Competencia</th><th>Aciertos</th><th>Error más común</th></tr></thead><tbody>${anV.map(x => `<tr><td class="num"><b>${x.pos}</b></td><td>${SHORT[x.area]}</td><td class="small">${esc(x.competencia || '')}</td><td style="min-width:150px"><div class="row" style="gap:8px;flex-wrap:nowrap">${barra(pct(x), pct(x) < 40 ? 'var(--n1)' : pct(x) < 55 ? 'var(--n2)' : 'var(--n4)')}<b class="num">${pct(x)}%</b></div></td><td>${x.error_comun ? `<span class="pill p-warn">Opción ${esc(x.error_comun)}</span>` : '<span class="muted">—</span>'}</td></tr>`).join('')}</tbody></table></div></div>` : ''}
    ${corp}`;

  const nombreArchivo = `FORTALECER ${A.simulacro} ${A.grupo}`.replace(/[^\w\- ]+/g, '');
  const tabla = () => [['Puesto', 'Estudiante', 'Documento', ...areasVer.map(i => AREAS[i]), ...(areaDocente == null ? ['Global'] : [])], ...orden.map(e => [puesto(e.id), e.nombre, e.documento, ...areasVer.map(i => areaVal(e, i)), ...(areaDocente == null ? [e.global] : [])]), ...est.filter(e => !e.presento).map(e => ['', e.nombre, e.documento, e.estado === 'respondiendo' ? 'Respondiendo' : parcial && e.estado === 'sin_empezar' ? 'Sin empezar' : 'No presentó'])];
  const seguimiento = () => [['Lista', 'Estudiante', 'Detalle'], ...honor.map(e => ['Cuadro de honor', e.nombre, areaDocente == null ? e.global : areaVal(e, areaDocente)]), ...riesgo.map(e => ['En riesgo', e.nombre, areasN.filter(i => nivel(i, areaVal(e, i) || 0) === 1).map(i => AREAS[i]).join(', ')]), ...cerca.map(c => ['Cerca de subir', c.e.nombre, `${AREAS[c.i]}: faltan ${c.falta} para ${c.sig}`]), ...(verSalidas ? est.filter(e => e.salidas).map(e => ['Salidas de la ventana', e.nombre, e.salidas]) : [])];
  const boletin = e => boletinHTML(A, e, { prom, promG, puesto: puesto(e.id), total: pres.length, areaVal });
  clearTimeout(reporteAplicacion.t);
  if (parcial) { const ruta = location.hash; reporteAplicacion.t = setTimeout(() => { if (location.hash === ruta && document.body.contains(main) && !$('#modalbox').innerHTML) reporteAplicacion(main, aplicacionId, { rol, areaDocente, volver }); }, 120000); }
  main.onclick = ev => {
    const b = ev.target.closest('button'); if (!b) return;
    if ('refrescar' in b.dataset) return reporteAplicacion(main, aplicacionId, { rol, areaDocente, volver });
    if (b.dataset.boletin) { const e = est.find(x => x.id === b.dataset.boletin); imprimir(boletin(e), `Boletín ${e.nombre}`); }
    if ('bolTodos' in b.dataset) { if (!pres.length) return toast('Nadie ha presentado este simulacro.'); imprimir(orden.map(boletin).join(''), `Boletines ${A.grupo}`); }
    if (b.dataset.dl === 'csv') descargarCSV(nombreArchivo, tabla());
    if (b.dataset.dl === 'xlsx') descargarExcel(nombreArchivo + (parcial ? ' AVANCE' : ''), { 'Resultados': tabla(), 'Seguimiento': seguimiento(), 'Por pregunta': [['Pregunta', 'Área', 'Competencia', '% aciertos', 'Error más común'], ...anV.map(x => [x.pos, AREAS[x.area], x.competencia, pct(x), x.error_comun || ''])] });
    if (b.dataset.dl === 'doc') descargarWord(nombreArchivo, reporteDoc(A, tabla(), prom, promG, areasVer));
    if (b.dataset.dl === 'pdf') imprimir(`<div class="paper">${reporteDoc(A, tabla(), prom, promG, areasVer)}</div>`, nombreArchivo);
  };
}

function reporteDoc(A, tabla, prom, promG, areasVer) {
  return `<h2 style="margin:0">${esc(A.colegio.nombre)}</h2><p>${esc(A.simulacro)} · grupo ${esc(A.grupo)} · ${fecha(A.inicio)}</p>
    <p><b>Promedio global:</b> ${promG} · ${areasVer.map(i => `<b>${AREAS[i]}:</b> ${prom[i]}`).join(' · ')}</p>
    <table border="1" cellpadding="4" cellspacing="0" style="border-collapse:collapse;font-size:12px;width:100%">${tabla.map((r, k) => `<tr>${r.map(v => k ? `<td>${esc(v ?? '')}</td>` : `<th>${esc(v)}</th>`).join('')}</tr>`).join('')}</table>
    <p style="font-size:10px;color:#666">Desarrollado por FORTALECER COMPANY</p>`;
}

export function boletinHTML(A, e, { prom, promG, puesto, total, areaVal }) {
  const vals = [0, 1, 2, 3, 4].map(i => areaVal(e, i) || 0);
  const debil = vals.indexOf(Math.min(...vals)), fuerte = vals.indexOf(Math.max(...vals));
  return `<div class="paper">
    <div class="phd"><div class="row" style="gap:12px;flex-wrap:nowrap">${escudo(A.colegio.escudo_url, A.colegio.nombre, 54)}<div><b style="font-size:15px;color:#141833">${esc(A.colegio.nombre)}</b><div style="font-size:11px;color:#5C6283">${esc(A.colegio.municipio || '')} · Grupo ${esc(A.grupo)}</div></div></div><div style="text-align:right"><svg width="22" height="25" aria-hidden="true"><use href="#logo"/></svg><div style="font:800 10px sans-serif;letter-spacing:.12em;color:#2B3A8C">FORTALECER</div></div></div>
    <div style="border-top:3px solid #2B3A8C;margin:12px 0 14px"></div>
    <div class="row between" style="align-items:flex-start"><div><div style="font:800 10px sans-serif;letter-spacing:.1em;color:#5C6283;text-transform:uppercase">Boletín individual · ${esc(A.simulacro)} · ${fecha(A.inicio)}</div><div style="font:700 22px Georgia,serif;color:#141833;margin-top:4px">${esc(e.nombre)}</div><div style="font-size:12px;color:#5C6283">Documento ${esc(e.documento || '')}</div></div>
      <div style="text-align:right"><div style="font:700 40px/1 Georgia,serif;color:#141833">${e.global}</div><div style="font-size:11px;color:#5C6283">puntaje global de 500 · puesto ${puesto} de ${total}</div></div></div>
    <div class="row" style="gap:18px;margin-top:14px;flex-wrap:nowrap;align-items:center"><div style="flex:none">${rings5(vals, 120)}</div>
      <table class="ptable"><thead><tr><th>Área</th><th class="r">Puntaje</th><th class="r">Grupo</th><th>Nivel</th></tr></thead><tbody>${vals.map((v, i) => `<tr><td><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${col(i)};margin-right:8px"></span>${AREAS[i]}</td><td class="r"><b>${v}</b></td><td class="r">${prom[i]}</td><td>${lvlTag(i, v)}</td></tr>`).join('')}</tbody></table></div>
    <div class="pnote"><b>Recomendación</b> Su área más fuerte es ${AREAS[fuerte]}. Para el próximo simulacro, reforzar ${AREAS[debil]}: ${esc(sugerencia(debil, ''))}</div>
    <div class="pfoot"><span>Puntaje por porcentaje de aciertos (versión 1). Preguntas: ICFES, Evaluar para Avanzar.</span><span>Desarrollado por <b>FORTALECER COMPANY</b></span></div></div>`;
}

// Lista de aplicaciones terminadas para elegir un reporte
export function listaAplicaciones(apls, grupos, { avance = false } = {}) {
  if (!apls.length) return vacio('i-results', 'Todavía no hay simulacros aplicados', 'Cuando un grupo presente un simulacro, su reporte aparecerá aquí.');
  const g = id => grupos.find(x => x.id === id);
  return `<div class="tw"><table><thead><tr><th>Simulacro</th><th>Grupo</th><th>Fecha</th><th>Estado</th><th></th></tr></thead><tbody>${apls.map(a => {
    const fin = new Date(new Date(a.inicio).getTime() + a.duracion_min * 60000); const ya = fin < new Date();
    return `<tr><td><b>Simulacro ${a.simulacro_id}</b></td><td>${g(a.grupo_id) ? `${g(a.grupo_id).grado}-${esc(g(a.grupo_id).nombre)}` : '—'}</td><td class="small">${fechaHora(a.inicio)}</td><td>${ya ? '<span class="pill p-ok">Terminado</span>' : new Date(a.inicio) > new Date() ? '<span class="pill p-info">Programado</span>' : '<span class="pill p-warn">En curso</span>'}</td><td class="r">${ya ? `<button class="btn pri sm" type="button" data-rep="${a.id}">Reporte final</button>` : avance && new Date(a.inicio) <= new Date() ? `<button class="btn sec sm" type="button" data-rep="${a.id}">${ic('i-clock', 14)}Ver avance</button><div class="xs muted">Final desde las ${hora(fin)}</div>` : `<span class="xs muted">Resultados desde las ${hora(fin)}</span>`}</td></tr>`;
  }).join('')}</tbody></table></div>`;
}

// Evolución de un grupo: promedio global por simulacro (línea) y tabla por área
export function evolucionHTML(datos) {
  if (!datos.length) return vacio('i-up', 'Sin simulacros terminados', 'Cuando el grupo termine su primer simulacro verá aquí cómo evoluciona.');
  const W = 960, H = 260, pl = 44, pr = 16, pt = 16, pb = 34;
  const vals = datos.map(d => d.global ?? 0);
  const max = Math.max(100, Math.ceil(Math.max(...vals) / 100) * 100);
  const x = i => datos.length === 1 ? (pl + W - pr) / 2 : pl + i * (W - pl - pr) / (datos.length - 1);
  const y = v => pt + (1 - v / max) * (H - pt - pb);
  const ticks = [0, max / 2, max];
  const linea = datos.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d.global ?? 0).toFixed(1)}`).join('');
  const area = `${linea}L${x(datos.length - 1).toFixed(1)},${y(0)}L${x(0).toFixed(1)},${y(0)}Z`;
  const ult = datos.length - 1, dif = datos.length > 1 ? (datos[ult].global ?? 0) - (datos[ult - 1].global ?? 0) : null;
  const svg = `<svg viewBox="0 0 ${W} ${H}" class="evo" role="img" aria-label="Promedio global del grupo en cada simulacro">
    ${ticks.map(t => `<line x1="${pl}" x2="${W - pr}" y1="${y(t)}" y2="${y(t)}" stroke="var(--line)" stroke-width="1"/><text x="${pl - 8}" y="${y(t) + 4}" text-anchor="end" font-size="11" fill="var(--muted)">${t}</text>`).join('')}
    <path d="${area}" fill="var(--brand-soft)" opacity=".6"/><path d="${linea}" fill="none" stroke="var(--brand)" stroke-width="2" stroke-linejoin="round"/>
    ${datos.map((d, i) => `<g><circle cx="${x(i)}" cy="${y(d.global ?? 0)}" r="${i === ult ? 6 : 4.5}" fill="var(--brand)" stroke="var(--surface)" stroke-width="2"/><circle cx="${x(i)}" cy="${y(d.global ?? 0)}" r="14" fill="transparent"><title>${esc(d.simulacro)} · ${fecha(d.inicio)}: promedio global ${d.global ?? '—'} (${d.presentaron} presentaron)</title></circle>
      <text x="${x(i)}" y="${H - 12}" text-anchor="middle" font-size="11" fill="var(--muted)">${esc(String(d.simulacro).replace('Simulacro ', 'S'))}</text></g>`).join('')}
    <text x="${x(ult)}" y="${y(datos[ult].global ?? 0) - 12}" text-anchor="middle" font-size="12" font-weight="700" fill="var(--ink)">${datos[ult].global ?? '—'}</text>
  </svg>`;
  return `<div style="display:grid;gap:12px">${dif != null ? `<p class="small">${dif >= 0 ? `Subió <b>${dif}</b>` : `Bajó <b>${-dif}</b>`} puntos frente al simulacro anterior.</p>` : ''}
    <div style="overflow-x:auto">${svg}</div>
    <div class="tw"><table><thead><tr><th>Simulacro</th><th>Fecha</th><th class="r">Presentaron</th>${SHORT.map(s => `<th class="r">${s}</th>`).join('')}<th class="r">Global</th></tr></thead><tbody>${datos.map(d => `<tr><td><b>${esc(d.simulacro)}</b></td><td class="small">${fecha(d.inicio)}</td><td class="r num">${d.presentaron}</td>${(d.areas || []).map(v => `<td class="r num">${v ?? '—'}</td>`).join('')}<td class="r num"><b>${d.global ?? '—'}</b></td></tr>`).join('')}</tbody></table></div></div>`;
}
