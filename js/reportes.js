// FORTALECER · reportes compartidos (coordinador, docente, administrador)
import { $, esc, ic, AREAS, SHORT, col, soft, aico, toast, errorMsg, head, kpi, cargando, vacio, corp, rings5, lvlTag, nivel, nivelNombre, lvLegend, heat, barra, fecha, fechaHora, hora, descargarCSV, descargarExcel, descargarWord, imprimir, globalDe, escudo } from './lib.js';
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

  const filas = orden.concat(est.filter(e => !e.presento)).map(e => `<tr><td class="num">${e.presento ? puesto(e.id) : '—'}</td><td><b class="small">${esc(e.nombre)}</b><div class="xs muted">${esc(e.documento || '')}</div></td>${areasVer.map(i => `<td class="r num">${e.presento ? areaVal(e, i) : '—'}</td>`).join('')}${areaDocente == null ? `<td class="r num"><b>${e.presento ? e.global : '—'}</b></td>` : ''}<td class="r">${e.presento ? `<button class="btn ghost sm" type="button" data-boletin="${e.id}" style="color:var(--brand)">Boletín</button>` : '<span class="pill p-mute">No presentó</span>'}</td></tr>`).join('');

  main.innerHTML = `${volver}${head(`${esc(A.colegio.nombre)} · grupo ${esc(A.grupo)}`, `${esc(A.simulacro)}${areaDocente != null ? ' · ' + AREAS[areaDocente] : ''}`, `<div class="row">
      <button class="btn pri" type="button" data-bol-todos>${ic('i-down', 16)}Boletines del grupo</button>
      <button class="btn sec sm" type="button" data-dl="xlsx">${ic('i-down', 15)}Excel</button><button class="btn sec sm" type="button" data-dl="csv">${ic('i-down', 15)}CSV</button><button class="btn sec sm" type="button" data-dl="doc">${ic('i-down', 15)}Word</button><button class="btn sec sm" type="button" data-dl="pdf">${ic('i-down', 15)}PDF</button></div>`)}
    <p class="small muted">Aplicado el ${fechaHora(A.inicio)} · terminó ${fechaHora(A.fin)}</p>
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
    </div>` : `<div class="card">${vacio('i-users', 'Nadie presentó este simulacro', 'Cuando los estudiantes lo presenten, aquí verá los resultados.')}</div>`}
    <div class="card"><div class="row between"><div><span class="lbl">Estudiantes</span><h2>Resultados individuales</h2></div><span class="xs muted">Ordenados por puesto</span></div>
      <div class="tw"><table><thead><tr><th>#</th><th>Estudiante</th>${areasVer.map(i => `<th class="r">${SHORT[i]}</th>`).join('')}${areaDocente == null ? '<th class="r">Global</th>' : ''}<th></th></tr></thead><tbody>${filas}</tbody></table></div></div>
    ${areaDocente == null || true ? `<div class="card"><div><span class="lbl">Análisis por pregunta</span><h2>Aciertos y error más común</h2></div><div class="tw" style="max-height:420px"><table><thead><tr><th>Pregunta</th><th>Área</th><th>Competencia</th><th>Aciertos</th><th>Error más común</th></tr></thead><tbody>${anV.map(x => `<tr><td class="num"><b>${x.pos}</b></td><td>${SHORT[x.area]}</td><td class="small">${esc(x.competencia || '')}</td><td style="min-width:150px"><div class="row" style="gap:8px;flex-wrap:nowrap">${barra(pct(x), pct(x) < 40 ? 'var(--n1)' : pct(x) < 55 ? 'var(--n2)' : 'var(--n4)')}<b class="num">${pct(x)}%</b></div></td><td>${x.error_comun ? `<span class="pill p-warn">Opción ${esc(x.error_comun)}</span>` : '<span class="muted">—</span>'}</td></tr>`).join('')}</tbody></table></div></div>` : ''}
    ${corp}`;

  const nombreArchivo = `FORTALECER ${A.simulacro} ${A.grupo}`.replace(/[^\w\- ]+/g, '');
  const tabla = () => [['Puesto', 'Estudiante', 'Documento', ...areasVer.map(i => AREAS[i]), ...(areaDocente == null ? ['Global'] : [])], ...orden.map(e => [puesto(e.id), e.nombre, e.documento, ...areasVer.map(i => areaVal(e, i)), ...(areaDocente == null ? [e.global] : [])]), ...est.filter(e => !e.presento).map(e => ['', e.nombre, e.documento, 'No presentó'])];
  const boletin = e => boletinHTML(A, e, { prom, promG, puesto: puesto(e.id), total: pres.length, areaVal });
  main.onclick = ev => {
    const b = ev.target.closest('button'); if (!b) return;
    if (b.dataset.boletin) { const e = est.find(x => x.id === b.dataset.boletin); imprimir(boletin(e), `Boletín ${e.nombre}`); }
    if ('bolTodos' in b.dataset) { if (!pres.length) return toast('Nadie ha presentado este simulacro.'); imprimir(orden.map(boletin).join(''), `Boletines ${A.grupo}`); }
    if (b.dataset.dl === 'csv') descargarCSV(nombreArchivo, tabla());
    if (b.dataset.dl === 'xlsx') descargarExcel(nombreArchivo, { 'Resultados': tabla(), 'Por pregunta': [['Pregunta', 'Área', 'Competencia', '% aciertos', 'Error más común'], ...anV.map(x => [x.pos, AREAS[x.area], x.competencia, pct(x), x.error_comun || ''])] });
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
export function listaAplicaciones(apls, grupos) {
  if (!apls.length) return vacio('i-results', 'Todavía no hay simulacros aplicados', 'Cuando un grupo presente un simulacro, su reporte aparecerá aquí.');
  const g = id => grupos.find(x => x.id === id);
  return `<div class="tw"><table><thead><tr><th>Simulacro</th><th>Grupo</th><th>Fecha</th><th>Estado</th><th></th></tr></thead><tbody>${apls.map(a => {
    const fin = new Date(new Date(a.inicio).getTime() + a.duracion_min * 60000); const ya = fin < new Date();
    return `<tr><td><b>Simulacro ${a.simulacro_id}</b></td><td>${g(a.grupo_id) ? `${g(a.grupo_id).grado}-${esc(g(a.grupo_id).nombre)}` : '—'}</td><td class="small">${fechaHora(a.inicio)}</td><td>${ya ? '<span class="pill p-ok">Terminado</span>' : new Date(a.inicio) > new Date() ? '<span class="pill p-info">Programado</span>' : '<span class="pill p-warn">En curso</span>'}</td><td class="r">${ya ? `<button class="btn pri sm" type="button" data-rep="${a.id}">Ver reporte</button>` : `<span class="xs muted">Resultados desde las ${hora(fin)}</span>`}</td></tr>`;
  }).join('')}</tbody></table></div>`;
}
