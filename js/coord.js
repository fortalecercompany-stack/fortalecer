// FORTALECER · pantallas del coordinador
import { $, $$, esc, ic, AREAS, SHORT, col, soft, aico, chip, toast, errorMsg, modal, cerrarModal, confirmar, head, kpi, cargando, vacio, corp, field, selectField, fecha, fechaHora, hora, pill, iniciales, leerExcel, descargarExcel, normal, GRADOS, notaTxt, notaHTML, escudo, imprimir, volverBtn, aplicarColor } from './lib.js';
import { resultadosEx, notasGrupoHTML } from './docente.js';
import { sb, q, rpc, usuarios } from './api.js';
import { reporteAplicacion, listaAplicaciones, evolucionHTML } from './reportes.js';
import { avisosHTML, conectarAvisos } from './avisos.js';

export async function render(ctx) {
  const { seccion } = ctx;
  if (seccion === 'estudiantes') return estudiantes(ctx);
  if (seccion === 'docentes') return docentes(ctx);
  if (seccion === 'simulacros') return simulacros(ctx);
  if (seccion === 'reportes') return reportes(ctx);
  if (seccion === 'ranking') return ranking(ctx);
  if (seccion === 'examenes') return examenesColegio(ctx);
  if (seccion === 'resultados_ex') return resultadosEx(ctx, 'examenes', 'Exámenes de docentes');
  if (seccion === 'notas') return notasColegio(ctx);
  if (seccion === 'boletines') return boletines(ctx);
  if (seccion === 'ajustes') return ajustes(ctx);
  if (seccion === 'cierre') return cierre(ctx);
  if (seccion === 'perfil') return perfilC(ctx);
  return inicio(ctx);
}

const grupoTxt = g => g ? `${g.grado}-${g.nombre}` : 'Sin grupo';
const ordenG = (a, b) => a.grado - b.grado || a.nombre.localeCompare(b.nombre);
async function cargarGrupos(S) { return (await q(sb.from('grupos').select('*').eq('colegio_id', S.perfil.colegio_id))).sort(ordenG); }
const finDe = a => new Date(new Date(a.inicio).getTime() + a.duracion_min * 60000);

function credenciales(lista, titulo = 'Usuarios creados') {
  modal({ icon: 'i-key', tono: 'ok', titulo, sub: 'Entregue estos datos a cada persona. En el primer ingreso deberá cambiar la contraseña.', ancho: true,
    cuerpo: `<div class="tw"><table><thead><tr><th>Nombre</th><th>Usuario</th><th>Contraseña inicial</th></tr></thead><tbody>${lista.map(c => `<tr><td>${esc(c.nombre)}</td><td class="num"><b>${esc(c.usuario)}</b></td><td class="num">${esc(c.clave)}</td></tr>`).join('')}</tbody></table></div>
      <p class="xs muted">La contraseña inicial es el número de documento. Dirección para ingresar: <b>${esc((location.origin + location.pathname))}</b></p>`,
    pie: `<button class="btn sec" type="button" id="dlcred">${ic('i-down', 15)}Descargar en Excel</button><button class="btn pri" type="button" data-cerrar>Listo</button>` });
  $('#dlcred').onclick = () => descargarExcel('Usuarios FORTALECER', { Usuarios: [['Nombre', 'Usuario', 'Contraseña inicial', 'Dirección'], ...lista.map(c => [c.nombre, c.usuario, c.clave, location.origin + location.pathname])] });
}

// ---------- Inicio: simulacros en vivo ----------
let vivo = null;
async function inicio({ S, main, go }) {
  clearInterval(vivo);
  main.innerHTML = cargando();
  const [grupos, apls, pend] = await Promise.all([
    cargarGrupos(S),
    q(sb.from('aplicaciones').select('*').eq('colegio_id', S.perfil.colegio_id).order('inicio', { ascending: false })),
    q(sb.from('perfiles').select('id', { count: 'exact', head: true }).eq('colegio_id', S.perfil.colegio_id).eq('rol', 'estudiante').eq('activo', true).eq('autorizacion_acudiente', false)),
  ]);
  const ahora = new Date();
  const enCurso = apls.filter(a => new Date(a.inicio) <= ahora && finDe(a) >= ahora);
  const proximas = apls.filter(a => new Date(a.inicio) > ahora).sort((a, b) => new Date(a.inicio) - new Date(b.inicio));
  const g = id => grupos.find(x => x.id === id);
  let sel = enCurso[0]?.id;
  let estVivo = [];
  let avHTML = await avisosHTML({ S, gestionar: true });
  const fin7 = new Date(); fin7.setDate(fin7.getDate() + 8);
  const ini7 = new Date(); ini7.setDate(ini7.getDate() - 7);
  const [sem, cal, pendC] = await Promise.all([rpc('semaforo_colegio').catch(() => []), rpc('calendario_colegio', { p_desde: ini7.toISOString(), p_hasta: fin7.toISOString() }).catch(() => []), rpc('pendientes_coord').catch(() => ({}))]);
  const extra = { sem, cal, pend: pendC };
  const pendiente = pend;
  const pintar = async () => {
    let sala = '';
    if (sel) {
      const a = enCurso.find(x => x.id === sel);
      let est = [];
      try { est = await rpc('estado_aplicacion', { p_aplicacion: sel }); } catch (e) { toast(errorMsg(e), 'error'); }
      const cuenta = k => est.filter(e => e.estado === k).length;
      const cls = { entrego: 's-done', respondiendo: 's-doing', sin_conexion: 's-off', sin_empezar: 's-not', bloqueado: 's-not', termino_tiempo: 's-done', sospecha: 's-bad' };
      const txt = { entrego: 'Entregó', respondiendo: 'Respondiendo', sin_conexion: 'Sin conexión', sin_empezar: 'Sin empezar', bloqueado: 'Sin autorización', termino_tiempo: 'Se acabó su tiempo', sospecha: 'Cerrado por sospecha' };
      sala = `<div class="card w8"><div class="row between"><div><span class="lbl">Sala en vivo · se actualiza cada 30 segundos</span><h2>Grupo ${esc(grupoTxt(g(a.grupo_id)))} · Simulacro ${a.simulacro_id}</h2></div>${enCurso.length > 1 ? `<div class="tabs" role="group">${enCurso.map(x => `<button type="button" data-sala="${x.id}" aria-pressed="${x.id === sel}">${esc(grupoTxt(g(x.grupo_id)))}</button>`).join('')}</div>` : ''}</div>
        ${est.length ? `<div class="room"><div class="board" aria-hidden="true"></div><div class="seats">${est.map(e => `<button type="button" class="seat ${cls[e.estado]}" data-est="${e.estudiante_id}" title="${esc(e.nombre)}: ${txt[e.estado]} · ${e.respondidas} respondidas${e.minutos_extra ? ' · +' + e.minutos_extra + ' min' : ''}${e.advertencias ? ' · ' + e.advertencias + ' advertencias' : ''}${e.reingresos ? ' · ' + e.reingresos + ' reingresos' : ''}">${esc(iniciales(e.nombre))}${e.advertencias ? `<span class="sal" aria-label="${e.advertencias} advertencias">${e.advertencias}</span>` : ''}</button>`).join('')}</div></div>` : vacio('i-users', 'Este grupo no tiene estudiantes')}
        <div class="legend"><span><i class="l4"></i>Entregó (${cuenta('entrego') + cuenta('termino_tiempo')})</span><span><i style="background:var(--a1)"></i>Respondiendo (${cuenta('respondiendo')})</span><span><i class="l2"></i>Sin conexión (${cuenta('sin_conexion')})</span><span><i style="background:var(--sunk)"></i>Sin empezar (${cuenta('sin_empezar')})</span>${cuenta('sospecha') ? `<span><i style="background:var(--bad)"></i>Sospecha (${cuenta('sospecha')})</span>` : ''}${cuenta('bloqueado') ? `<span>${cuenta('bloqueado')} sin autorización</span>` : ''}</div>
        <p class="xs muted">Toque un puesto para ampliar el tiempo o habilitar de nuevo a ese estudiante. El número naranja son las advertencias por salir de la ventana, capturas o copias. En rojo, los simulacros cerrados por sospecha. Termina a las ${hora(finDe(a))}</p>
        <div class="row"><button class="btn sec sm" type="button" data-avance="${a.id}">${ic('i-results', 15)}Ver avance de resultados</button></div></div>`;
      estVivo = est;
    }
    const total = enCurso.length;
    const P = extra.pend || {};
    const pendientes = [
      P.sin_periodos ? ['warn', 'Faltan los períodos', 'Créelos para que las notas se organicen por período.', 'ajustes'] : null,
      P.sin_autorizacion ? ['warn', `${P.sin_autorizacion} sin autorización del acudiente`, 'No pueden presentar simulacros.', 'estudiantes'] : null,
      P.docentes_sin_materias ? ['warn', `${P.docentes_sin_materias} ${P.docentes_sin_materias === 1 ? 'docente' : 'docentes'} sin materias`, 'Asígneles qué enseñan en cada grupo.', 'docentes'] : null,
      P.grupos_sin_estudiantes ? ['mute', `${P.grupos_sin_estudiantes} ${P.grupos_sin_estudiantes === 1 ? 'grupo vacío' : 'grupos vacíos'}`, 'Cargue sus estudiantes.', 'estudiantes'] : null,
      P.periodo && P.periodo.dias <= 10 && P.periodo.dias >= 0 ? ['warn', `${esc(P.periodo.nombre)} termina en ${P.periodo.dias} días`, 'Prepare los boletines.', 'boletines'] : null,
      P.examenes_abiertos ? ['mute', `${P.examenes_abiertos} ${P.examenes_abiertos === 1 ? 'examen de docente abierto' : 'exámenes de docentes abiertos'}`, 'Vea cómo van.', 'examenes'] : null,
    ].filter(Boolean);
    const pendHTML = pendientes.length ? pendientes.map(([t, b, x, r]) => `<div class="alerta-i ${t}"><span style="flex:1"><b>${b}</b><br><span class="xs muted">${x}</span></span><button class="btn sec sm" type="button" data-ir="${r}">Ir</button></div>`).join('') : `<div class="alert a-ok">${ic('i-sync')}<div><b>Todo al día</b>No hay pendientes.</div></div>`;
    const semHTML = extra.sem.length ? `<div class="tw"><table class="sem"><thead><tr><th>Grado</th>${SHORT.map(x => `<th>${x}</th>`).join('')}</tr></thead><tbody>${extra.sem.map(r => `<tr><th style="text-align:left">${r.grado}.° <span class="xs muted">${esc(r.simulacro || '')}</span></th>${r.areas.map(a => { const v = a.valor, c = v == null ? 's0' : v < 45 ? 's1' : v < 60 ? 's2' : 's3', dif = v != null && a.antes != null ? v - a.antes : null; return `<td class="${c}" title="${AREAS[a.area]}">${v ?? '—'}${dif ? `<br><span style="font-size:10.5px;font-weight:700">${dif > 0 ? '▲' : '▼'}${Math.abs(dif)}</span>` : ''}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div><p class="xs muted">Promedio del último simulacro de cada grado. Rojo: menos de 45. Amarillo: de 45 a 59. Verde: 60 o más. La flecha compara con el simulacro anterior.</p>`
      : vacio('i-results', 'Aún no hay simulacros terminados', 'El semáforo aparece cuando un grado termine su primer simulacro.');
    const lunes = new Date(); lunes.setHours(0, 0, 0, 0); lunes.setDate(lunes.getDate() - ((lunes.getDay() + 6) % 7));
    const dias = Array.from({ length: 7 }, (_, i) => { const d = new Date(lunes); d.setDate(d.getDate() + i); return d; });
    const filasCal = dias.map(d => { const fin = new Date(d); fin.setDate(fin.getDate() + 1); const ev = extra.cal.filter(e => new Date(e.inicio) < fin && new Date(e.fin) > d); return { d, ev, hoy: d.toDateString() === new Date().toDateString() }; }).filter(x => x.ev.length || x.hoy);
    const calHTML = `<div class="cal">${filasCal.map(({ d, ev, hoy }) => `<div class="d ${hoy ? 'hoy' : ''}"><b>${new Intl.DateTimeFormat('es-CO', { weekday: 'short', day: 'numeric' }).format(d)}${hoy ? ' · hoy' : ''}</b><div class="evs">${ev.map(e => `<span class="ev ${e.tipo}" title="${esc(e.titulo)} · ${esc(e.grupo)} · ${fechaHora(e.inicio)} a ${fechaHora(e.fin)}">${esc(e.grupo)} · ${esc(e.titulo)}</span>`).join('') || '<span class="xs muted">Nada programado</span>'}</div></div>`).join('')}</div><div class="legend"><span><i style="background:var(--coral)"></i>Simulacro</span><span><i style="background:var(--a1)"></i>Examen</span><span><i style="background:var(--a3)"></i>Taller</span></div>`;
    main.innerHTML = `${head(fecha(ahora), total ? `${total} ${total === 1 ? 'simulacro en curso' : 'simulacros en curso'}` : `Hola, ${esc(S.perfil.nombres.split(' ')[0])}.`, `<button class="btn pri" type="button" data-ir="simulacros">${ic('i-cal', 18)}Programar simulacros</button><button class="btn sec" type="button" data-ir="reportes">${ic('i-results', 18)}Reportes</button>`,
        { sub: proximas[0] ? `Próximo simulacro: <b>Simulacro ${proximas[0].simulacro_id}</b> para ${esc(grupoTxt(g(proximas[0].grupo_id)))}, el ${fechaHora(proximas[0].inicio)}.` : `${grupos.length} grupos · ${apls.filter(a => finDe(a) < ahora).length} simulacros aplicados.` })}
      <div class="bento">
        ${sala || `<div class="card w8"><div><span class="lbl">Sala en vivo</span><h2>No hay simulacros en curso</h2></div><p class="small muted">Cuando un grupo esté presentando un simulacro, aquí verá a cada estudiante: quién responde, quién entregó y quién perdió la conexión.</p></div>`}
        <div class="card w4" style="gap:10px"><div><span class="lbl">Pendientes</span><h2>Por revisar</h2></div>${pendHTML}</div>
        <div class="card w7"><div><span class="lbl">Simulacros ICFES</span><h2>Semáforo por grado</h2></div>${semHTML}</div>
        <div class="card w5"><div class="row between"><div><span class="lbl">Esta semana</span><h2>Calendario</h2></div><button class="btn ghost sm" type="button" data-ir="examenes">Exámenes</button></div>${calHTML}</div>
        ${avHTML}
      </div>${corp}`;
    document.dispatchEvent(new Event('f-pintado'));
    conectarAvisos(main, { S, alCambiar: async () => { avHTML = await avisosHTML({ S, gestionar: true }); pintar(); } });
  };
  await pintar();
  vivo = setInterval(() => { if (!document.body.contains(main) || location.hash !== '#/inicio') return clearInterval(vivo); if (sel && !$('#modalbox').innerHTML) pintar(); }, 30000);
  main.onclick = async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.sala) { sel = b.dataset.sala; pintar(); }
    if (b.dataset.avance) go('reportes/' + b.dataset.avance);
    if (b.dataset.est) accionesEstudiante(sel, b.dataset.est, estVivo.find(x => x.estudiante_id === b.dataset.est), pintar);
  };
}
function accionesEstudiante(apl, estId, info, despues) {
  const cerrado = info?.estado === 'entrego' || info?.estado === 'sospecha';
  const inc = info?.incidentes || [];
  const w = modal({ icon: info?.sospecha ? 'i-warn' : 'i-user', tono: info?.sospecha ? 'bad' : 'brand', titulo: esc(info?.nombre || 'Estudiante'), sub: 'Seguimiento y ajustes para este simulacro', form: true, ancho: true,
    cuerpo: `${info?.sospecha ? `<div class="alert a-warn" style="background:var(--bad-soft);color:var(--bad)">${ic('i-warn')}<div><b>Sospecha de fraude</b>${esc(info.motivo || '')}</div></div>` : ''}
      <div class="grid g3" style="gap:10px"><div class="card kpi" style="box-shadow:none"><div><div class="v">${info?.respondidas ?? 0}</div><div class="d">respondidas</div></div></div><div class="card kpi" style="box-shadow:none"><div><div class="v">${info?.advertencias ?? 0}</div><div class="d">advertencias</div></div></div><div class="card kpi" style="box-shadow:none"><div><div class="v">${info?.reingresos ?? 0}</div><div class="d">reingresos</div></div></div></div>
      ${inc.length ? `<div style="display:grid;gap:6px"><span class="lbl">Registro de incidentes</span><ol class="inclist">${inc.map(x => `<li><b>${fechaHora(x.hora)}</b> · ${esc(x.tipo)}${x.detalle ? ` (${esc(x.detalle)})` : ''}${x.cuenta ? ' <span class="pill p-warn">advertencia</span>' : ''}</li>`).join('')}</ol></div>` : '<p class="small muted">Sin incidentes registrados.</p>'}
      ${selectField('mins', 'Ampliar tiempo', [[30, '30 minutos'], [60, '1 hora'], [120, '2 horas']], 60, 'Úselo si hubo problemas de luz o de conexión. Conserva sus respuestas.')}
      ${cerrado ? `<div class="alert a-info">${ic('i-info')}<div><b>${info?.estado === 'sospecha' ? 'El sistema cerró este simulacro' : 'Ya entregó'}</b>Si lo considera justo, puede habilitarlo de nuevo: conserva sus respuestas y se le reinician las advertencias.</div></div>` : ''}`,
    pie: `${cerrado ? `<button class="btn sec" type="button" id="reabrir">Habilitar de nuevo</button>` : ''}<button class="btn sec" type="button" data-cerrar>Cerrar</button><button class="btn pri" type="submit">Ampliar tiempo</button>` });
  w.querySelector('form').onsubmit = async e => { e.preventDefault(); try { await rpc('ampliar_tiempo', { p_aplicacion: apl, p_estudiante: estId, p_minutos: +$('#mins').value }); cerrarModal(); toast('Tiempo ampliado.'); despues(); } catch (er) { toast(errorMsg(er), 'error'); } };
  const r = w.querySelector('#reabrir'); if (r) r.onclick = async () => { try { await rpc('reabrir_intento', { p_aplicacion: apl, p_estudiante: estId }); cerrarModal(); toast('Habilitado de nuevo. Si su tiempo ya terminó, amplíelo.'); despues(); } catch (er) { toast(errorMsg(er), 'error'); } };
}

// ---------- Estudiantes y grupos ----------
async function estudiantes({ S, main, recargar }) {
  main.innerHTML = cargando();
  const [grupos, est] = await Promise.all([cargarGrupos(S), q(sb.from('perfiles').select('*').eq('colegio_id', S.perfil.colegio_id).eq('rol', 'estudiante').order('apellidos'))]);
  let filtro = main.dataset.fg || '', buscar = '';
  const g = id => grupos.find(x => x.id === id);
  const pintarTabla = () => {
    const L = est.filter(e => (!filtro || e.grupo_id === filtro) && (!buscar || normal(e.nombres + ' ' + e.apellidos + ' ' + e.documento).includes(normal(buscar))));
    $('#tbody').innerHTML = L.length ? L.map(e => `<tr><td><div class="row" style="gap:10px;flex-wrap:nowrap"><span class="av" style="width:34px;height:34px;font-size:11px;border-radius:10px">${esc(iniciales(e.nombres + ' ' + e.apellidos))}</span><div><b class="small">${esc(e.apellidos)} ${esc(e.nombres)}</b>${e.activo ? '' : ' <span class="pill p-mute">Inactivo</span>'}</div></div></td><td class="num">${esc(e.documento)}</td><td>${esc(grupoTxt(g(e.grupo_id)))}</td>
      <td><label class="toggle" title="Autorización del acudiente"><input type="checkbox" data-aut="${e.id}" ${e.autorizacion_acudiente ? 'checked' : ''} aria-label="Autorización de ${esc(e.nombres)}"><span></span></label></td>
      <td class="r"><div class="row" style="justify-content:flex-end;gap:4px;flex-wrap:nowrap"><button class="ibtn" type="button" data-editar="${e.id}" title="Editar">${ic('i-edit', 16)}</button><button class="ibtn" type="button" data-reset="${e.id}" title="Restablecer contraseña">${ic('i-key', 16)}</button><button class="ibtn ${e.activo ? 'danger' : ''}" type="button" data-activo="${e.id}" title="${e.activo ? 'Desactivar' : 'Activar'}">${ic(e.activo ? 'i-exit' : 'i-sync', 16)}</button></div></td></tr>`).join('')
      : `<tr><td colspan="5">${vacio('i-users', est.length ? 'No hay estudiantes con ese filtro' : 'Todavía no hay estudiantes', est.length ? '' : 'Agréguelos uno por uno o cárguelos con un Excel.')}</td></tr>`;
    $('#nest').textContent = L.length;
  };
  main.innerHTML = `${head(esc(S.colegio.nombre), 'Estudiantes', `<div class="row"><button class="btn sec" type="button" data-grupos>${ic('i-school', 16)}Grupos</button><button class="btn sec" type="button" data-excel>${ic('i-upload', 16)}Cargar Excel</button><button class="btn pri" type="button" data-nuevo>+ Agregar estudiante</button></div>`)}
    <div class="grid g4">${kpi('i-users', 'var(--brand)', 'var(--brand-soft)', est.filter(e => e.activo).length, 'estudiantes activos')}${kpi('i-sync', 'var(--ok)', 'var(--ok-soft)', est.filter(e => e.activo && e.autorizacion_acudiente).length, 'con autorización')}${kpi('i-warn', 'var(--warn)', 'var(--warn-soft)', est.filter(e => e.activo && !e.autorizacion_acudiente).length, 'sin autorización')}${kpi('i-school', 'var(--a4)', 'var(--a4s)', grupos.length, 'grupos')}</div>
    <div class="card"><div class="filters"><div class="sfield">${ic('i-search', 18)}<input id="bq" placeholder="Buscar por nombre o documento"></div>
      <select id="fg" aria-label="Grupo"><option value="">Todos los grupos</option>${grupos.map(x => `<option value="${x.id}" ${filtro === x.id ? 'selected' : ''}>${esc(grupoTxt(x))}</option>`).join('')}</select>
      <button class="btn sec sm" type="button" data-resetg>Restablecer contraseñas del grupo</button><button class="btn ghost sm" type="button" data-lista>${ic('i-down', 15)}Descargar lista</button></div>
      <span class="small"><b id="nest">0</b> estudiantes</span>
      <div class="tw"><table><thead><tr><th>Estudiante</th><th>Documento</th><th>Grupo</th><th>Autorización</th><th class="r">Acciones</th></tr></thead><tbody id="tbody"></tbody></table></div>
      <p class="xs muted">La autorización del acudiente es obligatoria para presentar simulacros. El usuario de cada estudiante es su número de documento.</p></div>${corp}`;
  pintarTabla();
  main.oninput = e => { if (e.target.id === 'bq') { buscar = e.target.value; pintarTabla(); } };
  main.onchange = async e => {
    if (e.target.id === 'fg') { filtro = e.target.value; main.dataset.fg = filtro; pintarTabla(); }
    if (e.target.dataset.aut) {
      const id = e.target.dataset.aut, v = e.target.checked;
      try { await q(sb.from('perfiles').update({ autorizacion_acudiente: v }).eq('id', id)); est.find(x => x.id === id).autorizacion_acudiente = v; toast(v ? 'Autorización registrada.' : 'Autorización retirada.'); }
      catch (er) { e.target.checked = !v; toast(errorMsg(er), 'error'); }
    }
  };
  main.onclick = async e => {
    const b = e.target.closest('button'); if (!b) return; const d = b.dataset;
    if ('nuevo' in d) return nuevoEstudiante(S, grupos, filtro, recargar);
    if ('excel' in d) return cargarExcel(S, grupos, filtro, recargar);
    if ('grupos' in d) return gestionarGrupos(S, grupos, est, recargar);
    if ('lista' in d) return descargarExcel('Estudiantes ' + S.colegio.nombre, { Estudiantes: [['Apellidos', 'Nombres', 'Documento', 'Grupo', 'Autorización', 'Activo'], ...est.map(x => [x.apellidos, x.nombres, x.documento, grupoTxt(g(x.grupo_id)), x.autorizacion_acudiente ? 'Sí' : 'No', x.activo ? 'Sí' : 'No'])] });
    if (d.reset) { const x = est.find(y => y.id === d.reset); if (await confirmar({ titulo: 'Restablecer contraseña', texto: `La contraseña de <b>${esc(x.nombres)} ${esc(x.apellidos)}</b> volverá a ser su número de documento (${esc(x.documento)}).`, si: 'Restablecer' })) { try { await usuarios({ accion: 'restablecer', id: x.id }); toast('Contraseña restablecida.'); } catch (er) { toast(errorMsg(er), 'error'); } } }
    if ('resetg' in d) {
      if (!filtro) return toast('Primero elija un grupo en el filtro.');
      const ids = est.filter(x => x.grupo_id === filtro && x.activo).map(x => x.id);
      if (await confirmar({ titulo: 'Restablecer contraseñas del grupo', texto: `Las contraseñas de los ${ids.length} estudiantes de ${esc(grupoTxt(g(filtro)))} volverán a ser su número de documento.`, si: 'Restablecer todas' })) { try { await usuarios({ accion: 'restablecer', ids }); toast('Contraseñas restablecidas.'); } catch (er) { toast(errorMsg(er), 'error'); } }
    }
    if (d.activo) { const x = est.find(y => y.id === d.activo); const acc = x.activo ? 'desactivar' : 'activar';
      if (await confirmar({ titulo: x.activo ? 'Desactivar estudiante' : 'Activar estudiante', texto: x.activo ? `<b>${esc(x.nombres)} ${esc(x.apellidos)}</b> no podrá ingresar. Su información y resultados se conservan. Úselo, por ejemplo, con egresados.` : `<b>${esc(x.nombres)}</b> podrá ingresar de nuevo.`, si: x.activo ? 'Desactivar' : 'Activar', peligro: x.activo })) { try { await usuarios({ accion: acc, id: x.id }); toast(x.activo ? 'Estudiante desactivado.' : 'Estudiante activado.'); recargar(); } catch (er) { toast(errorMsg(er), 'error'); } } }
    if (d.editar) editarEstudiante(est.find(y => y.id === d.editar), grupos, recargar);
  };
}
function nuevoEstudiante(S, grupos, grupoSel, recargar) {
  if (!grupos.length) return toast('Primero cree los grupos (botón «Grupos»).', 'error');
  const w = modal({ icon: 'i-users', titulo: 'Agregar estudiante', sub: 'Su usuario y contraseña inicial serán el número de documento', form: true, ancho: true,
    cuerpo: `<div class="grid" style="gap:12px;align-items:start;grid-template-columns:repeat(auto-fit,minmax(200px,1fr))">${field('en', 'Nombres', '', 'required')}${field('ea', 'Apellidos', '', 'required')}${field('ed', 'Número de documento', '', 'required inputmode="numeric"')}${selectField('eg', 'Grupo', grupos.map(x => [x.id, grupoTxt(x)]), grupoSel)}</div>
      <label class="switch"><input type="checkbox" id="eaut"> El acudiente ya firmó la autorización</label>`,
    pie: `<button class="btn sec" type="button" data-cerrar>Cancelar</button><button class="btn pri" type="submit" id="gbtn">Guardar estudiante</button>` });
  w.querySelector('form').onsubmit = async e => {
    e.preventDefault();
    const p = { rol: 'estudiante', nombres: $('#en').value.trim(), apellidos: $('#ea').value.trim(), documento: $('#ed').value.replace(/\D/g, ''), grupo_id: $('#eg').value, autorizacion_acudiente: $('#eaut').checked };
    if (!p.nombres || !p.apellidos || p.documento.length < 5) return toast('Complete nombres, apellidos y un documento válido.', 'error');
    $('#gbtn').disabled = true;
    try { const r = await usuarios({ accion: 'crear', persona: p }); cerrarModal(); credenciales([r], 'Estudiante registrado'); recargar(); }
    catch (er) { $('#gbtn').disabled = false; toast(errorMsg(er), 'error'); }
  };
}
function editarEstudiante(x, grupos, recargar) {
  const w = modal({ icon: 'i-edit', titulo: 'Editar estudiante', form: true,
    cuerpo: `${field('xn', 'Nombres', x.nombres, 'required')}${field('xa', 'Apellidos', x.apellidos, 'required')}${selectField('xg', 'Grupo', grupos.map(g => [g.id, grupoTxt(g)]), x.grupo_id)}<p class="xs muted">El documento no se puede cambiar porque es su usuario.</p>`,
    pie: `<button class="btn sec" type="button" data-cerrar>Cancelar</button><button class="btn pri" type="submit">Guardar</button>` });
  w.querySelector('form').onsubmit = async e => { e.preventDefault(); try { await q(sb.from('perfiles').update({ nombres: $('#xn').value.trim(), apellidos: $('#xa').value.trim(), grupo_id: $('#xg').value }).eq('id', x.id)); cerrarModal(); toast('Cambios guardados.'); recargar(); } catch (er) { toast(errorMsg(er), 'error'); } };
}
function cargarExcel(S, grupos, grupoSel, recargar) {
  if (!grupos.length) return toast('Primero cree los grupos (botón «Grupos»).', 'error');
  let filas = [];
  const w = modal({ icon: 'i-upload', tono: 'ok', titulo: 'Cargar estudiantes desde Excel', sub: 'Varios estudiantes a la vez', ancho: true,
    cuerpo: `<div class="grid g2" style="gap:12px">${selectField('xg', 'Grupo al que entran', grupos.map(x => [x.id, grupoTxt(x)]), grupoSel)}<div class="field"><label for="xf">Archivo de Excel</label><input id="xf" type="file" accept=".xlsx,.xls,.csv"></div></div>
      <div style="display:grid;gap:6px"><span class="lbl">Columnas en este orden (la primera fila son los títulos)</span><div class="row" style="gap:6px"><span class="colchip">NOMBRES</span><span class="colchip">APELLIDOS</span><span class="colchip">NUMERO DOCUMENTO</span></div></div>
      <button class="btn ghost sm" type="button" id="plantilla" style="justify-self:start;color:var(--brand)">${ic('i-down', 15)}Descargar plantilla</button>
      <label class="switch"><input type="checkbox" id="xaut"> Todos tienen la autorización del acudiente firmada</label>
      <div id="xprev"></div>`,
    pie: `<button class="btn sec" type="button" data-cerrar>Cancelar</button><button class="btn pri" type="button" id="xgo" disabled>Registrar</button>` });
  $('#plantilla').onclick = () => descargarExcel('Plantilla estudiantes FORTALECER', { Estudiantes: [['NOMBRES', 'APELLIDOS', 'NUMERO DOCUMENTO'], ['Laura Camila', 'Ortiz Gómez', '1098765432']] });
  $('#xf').onchange = async ev => {
    const f = ev.target.files[0]; if (!f) return;
    try {
      const raw = await leerExcel(f);
      const cuerpo = raw.filter(r => r.some(c => String(c).trim()));
      const tieneTitulo = cuerpo.length && /nombre/i.test(String(cuerpo[0][0]));
      const docsExist = new Set();
      filas = (tieneTitulo ? cuerpo.slice(1) : cuerpo).map(r => {
        const doc = String(r[2] ?? '').replace(/\D/g, ''), n = String(r[0] ?? '').trim(), a = String(r[1] ?? '').trim();
        const err = !n ? 'Falta el nombre' : !a ? 'Faltan los apellidos' : doc.length < 5 ? 'Documento no válido' : docsExist.has(doc) ? 'Documento repetido en el archivo' : '';
        docsExist.add(doc); return { nombres: n, apellidos: a, documento: doc, err };
      });
      const ok = filas.filter(x => !x.err).length;
      $('#xprev').innerHTML = `<div class="alert ${ok ? 'a-ok' : 'a-warn'}">${ic(ok ? 'i-sync' : 'i-warn')}<div><b>${esc(f.name)}: ${ok} listos${filas.length - ok ? `, ${filas.length - ok} con error` : ''}</b>Los que ya existan en el sistema se informarán al final y no se duplican.</div></div>
        <div class="tw" style="max-height:260px;border:1px solid var(--line)"><table><thead><tr><th>Nombres</th><th>Apellidos</th><th>Documento</th><th>Estado</th></tr></thead><tbody>${filas.slice(0, 200).map(x => `<tr><td>${esc(x.nombres)}</td><td>${esc(x.apellidos)}</td><td class="num">${esc(x.documento)}</td><td>${x.err ? pill(esc(x.err), 'p-warn') : pill('Listo', 'p-ok')}</td></tr>`).join('')}</tbody></table></div>`;
      $('#xgo').disabled = !ok; $('#xgo').textContent = `Registrar ${ok}`;
    } catch (er) { toast('No se pudo leer el archivo: ' + errorMsg(er), 'error'); }
  };
  $('#xgo').onclick = async () => {
    const lista = filas.filter(x => !x.err).map(x => ({ ...x, rol: 'estudiante', grupo_id: $('#xg').value, autorizacion_acudiente: $('#xaut').checked }));
    const btn = $('#xgo'); btn.disabled = true; btn.textContent = 'Registrando… no cierre la ventana';
    try {
      let creados = [], errores = [];
      for (let i = 0; i < lista.length; i += 40) { const r = await usuarios({ accion: 'crear_lote', personas: lista.slice(i, i + 40) }); creados = creados.concat(r.creados); errores = errores.concat(r.errores); btn.textContent = `Registrando… ${Math.min(i + 40, lista.length)} de ${lista.length}`; }
      cerrarModal();
      if (errores.length) toast(`${errores.length} no se registraron: ${errores.slice(0, 3).map(e => e.error).join('; ')}`, 'error');
      if (creados.length) credenciales(creados, `${creados.length} estudiantes registrados`);
      recargar();
    } catch (er) { btn.disabled = false; btn.textContent = 'Reintentar'; toast(errorMsg(er), 'error'); }
  };
}
function gestionarGrupos(S, grupos, est, recargar) {
  const cuenta = id => est.filter(e => e.grupo_id === id).length;
  const w = modal({ icon: 'i-school', titulo: 'Grupos del colegio', sub: 'Cree los grupos antes de cargar estudiantes', form: true,
    cuerpo: `<div class="gradelist">${GRADOS.filter(k => grupos.some(g => g.grado === k) || k >= 9).map(k => `<div class="graderow"><b style="min-width:90px">Grado ${k}.°</b><div class="row" style="gap:6px;flex:1">${grupos.filter(g => g.grado === k).map(g => `<span class="gchip">${k}-${esc(g.nombre)} <small class="muted">(${cuenta(g.id)})</small><button type="button" data-rmg="${g.id}" aria-label="Quitar grupo">×</button></span>`).join('') || '<span class="xs muted">Sin grupos</span>'}</div></div>`).join('')}</div>
      <div class="grid g2" style="gap:12px;align-items:end">${selectField('ngr', 'Grado', GRADOS.map(k => [k, k + '.°']), 11)}${field('nno', 'Nombre del grupo', '', 'maxlength="6" placeholder="A, B, 01…"')}</div>`,
    pie: `<button class="btn sec" type="button" data-cerrar>Cerrar</button><button class="btn pri" type="submit">+ Crear grupo</button>`, onClose: recargar });
  w.querySelector('form').onsubmit = async e => {
    e.preventDefault(); const nombre = $('#nno').value.trim().toUpperCase(); if (!nombre) return toast('Escriba el nombre del grupo.', 'error');
    try { await q(sb.from('grupos').insert({ colegio_id: S.perfil.colegio_id, grado: +$('#ngr').value, nombre })); toast(`Grupo ${$('#ngr').value}-${nombre} creado.`); cerrarModal(); } catch (er) { toast(errorMsg(er), 'error'); }
  };
  w.onclick = async e => { const b = e.target.closest('[data-rmg]'); if (!b) return; if (cuenta(b.dataset.rmg)) return toast('Ese grupo tiene estudiantes. Muévalos antes de quitarlo.', 'error');
    try { await q(sb.from('grupos').delete().eq('id', b.dataset.rmg)); toast('Grupo quitado.'); cerrarModal(); } catch (er) { toast(errorMsg(er), 'error'); } };
}

// ---------- Docentes ----------
async function docentes({ S, main, recargar }) {
  main.innerHTML = cargando();
  const [grupos, docs, dg, asig, mats] = await Promise.all([cargarGrupos(S), q(sb.from('perfiles').select('*').eq('colegio_id', S.perfil.colegio_id).eq('rol', 'docente').order('apellidos')), q(sb.from('docente_grupos').select('*')), q(sb.from('asignaciones').select('*')), q(sb.from('materias').select('*').eq('colegio_id', S.perfil.colegio_id).order('nombre'))]);
  const mN = Object.fromEntries(mats.map(m => [m.id, m.nombre]));
  const gruposDe = id => dg.filter(x => x.docente_id === id).map(x => grupos.find(g => g.id === x.grupo_id)).filter(Boolean).sort(ordenG);
  main.innerHTML = `${head(esc(S.colegio.nombre), 'Docentes', `<button class="btn pri" type="button" data-nuevo>+ Agregar docente</button>`)}
    <div class="card">${docs.length ? `<div class="tw"><table><thead><tr><th>Docente</th><th>Área ICFES</th><th>Materias y grupos</th><th>Estado</th><th class="r">Acciones</th></tr></thead><tbody>${docs.map(d => `<tr><td><div class="row" style="gap:10px;flex-wrap:nowrap"><span class="av" style="width:34px;height:34px;font-size:11px;border-radius:10px;background:${d.area != null ? col(d.area) : 'var(--brand)'}">${esc(iniciales(d.nombres + ' ' + d.apellidos))}</span><div><b class="small">${esc(d.nombres)} ${esc(d.apellidos)}</b><div class="xs muted">${esc(d.email)}</div></div></div></td>
      <td>${d.area != null ? chip(d.area) : ''}${d.componente ? `<div class="xs muted">${esc(d.componente)}</div>` : ''}</td><td class="small">${(asig.filter(a => a.docente_id === d.id).map(a => `${esc(mN[a.materia_id] || '')} ${esc(grupoTxt(grupos.find(g => g.id === a.grupo_id)))}`).join(', ') || '<span class="muted">Sin materias</span>')}</td><td>${d.activo ? (d.debe_cambiar_clave ? pill('No ha ingresado', 'p-warn') : pill('Activo', 'p-ok')) : pill('Inactivo')}</td>
      <td class="r"><div class="row" style="justify-content:flex-end;gap:4px;flex-wrap:nowrap"><button class="ibtn" type="button" data-mat="${d.id}" title="Materias y grupos">${ic('i-school', 16)}</button><button class="ibtn" type="button" data-reset="${d.id}" title="Restablecer contraseña">${ic('i-key', 16)}</button><button class="ibtn ${d.activo ? 'danger' : ''}" type="button" data-activo="${d.id}" title="${d.activo ? 'Desactivar' : 'Activar'}">${ic(d.activo ? 'i-exit' : 'i-sync', 16)}</button></div></td></tr>`).join('')}</tbody></table></div>`
    : vacio('i-teacher', 'Todavía no hay docentes', 'Agregue a cada docente con su correo. Luego asígnele sus materias en cada grupo.')}
    <p class="xs muted">Toque el botón de materias para decir qué enseña cada docente en cada grupo. Así puede crear exámenes y ver las notas de esos grupos. Si olvida la contraseña, la recupera con su correo.</p></div>${corp}`;
  const checks = sel => `<fieldset style="border:0;padding:0;margin:0;display:grid;gap:8px"><legend style="font:700 13.5px var(--sans);margin-bottom:6px">Grupos a su cargo</legend><div class="row small">${grupos.map(g => `<label class="switch"><input type="checkbox" name="gr" value="${g.id}" ${sel.includes(g.id) ? 'checked' : ''}> ${esc(grupoTxt(g))}</label>`).join('') || '<span class="muted">Primero cree los grupos en Estudiantes.</span>'}</div></fieldset>`;
  main.onclick = async e => {
    const b = e.target.closest('button'); if (!b) return; const d = b.dataset;
    if ('nuevo' in d) {
      const w = modal({ icon: 'i-teacher', titulo: 'Agregar docente', sub: 'Usuario: su correo · contraseña inicial: su documento', form: true, ancho: true,
        cuerpo: `<div class="grid" style="gap:12px;align-items:start;grid-template-columns:repeat(auto-fit,minmax(200px,1fr))">${field('dn', 'Nombres', '', 'required')}${field('da', 'Apellidos', '', 'required')}${field('dd', 'Número de documento', '', 'required inputmode="numeric"')}${field('de', 'Correo', '', 'type="email" required', 'Puede ser Gmail, Hotmail u otro.')}${selectField('dar', 'Área ICFES que enseña', [['', 'Ninguna (primaria u otra materia)'], ...AREAS.map((a, i) => [i, a])], 1, 'Sirve para ver los reportes de los simulacros. Las materias se asignan después.')}<div class="field" id="compbox" hidden>${selectField('dc', 'Componente de Ciencias', ['Biología', 'Química', 'Física', 'Química y Física', 'Ciencia, tecnología y sociedad'])}</div></div>${checks([])}`,
        pie: `<button class="btn sec" type="button" data-cerrar>Cancelar</button><button class="btn pri" type="submit" id="gbtn">Guardar docente</button>` });
      $('#dar').onchange = () => { $('#compbox').hidden = $('#dar').value !== '3'; };
      w.querySelector('form').onsubmit = async ev => {
        ev.preventDefault();
        const p = { rol: 'docente', nombres: $('#dn').value.trim(), apellidos: $('#da').value.trim(), documento: $('#dd').value.replace(/\D/g, ''), email: $('#de').value.trim(), area: $('#dar').value === '' ? null : +$('#dar').value, componente: $('#dar').value === '3' ? $('#dc').value : null, grupos: $$('input[name=gr]:checked', w).map(x => x.value) };
        if (!p.nombres || !p.apellidos || p.documento.length < 5 || !p.email.includes('@')) return toast('Complete todos los datos con un correo válido.', 'error');
        $('#gbtn').disabled = true;
        try { const r = await usuarios({ accion: 'crear', persona: p }); cerrarModal(); credenciales([r], 'Docente registrado'); recargar(); } catch (er) { $('#gbtn').disabled = false; toast(errorMsg(er), 'error'); }
      };
    }
    if (d.grp) {
      const doc = docs.find(x => x.id === d.grp);
      const w = modal({ icon: 'i-school', titulo: 'Grupos de ' + esc(doc.nombres), form: true, cuerpo: checks(gruposDe(doc.id).map(g => g.id)), pie: `<button class="btn sec" type="button" data-cerrar>Cancelar</button><button class="btn pri" type="submit">Guardar</button>` });
      w.querySelector('form').onsubmit = async ev => { ev.preventDefault(); try { await q(sb.from('docente_grupos').delete().eq('docente_id', doc.id)); const sel = $$('input[name=gr]:checked', w).map(x => ({ docente_id: doc.id, grupo_id: x.value })); if (sel.length) await q(sb.from('docente_grupos').insert(sel)); cerrarModal(); toast('Grupos guardados.'); recargar(); } catch (er) { toast(errorMsg(er), 'error'); } };
    }
    if (d.mat) return materiasDocente(docs.find(x => x.id === d.mat), grupos, mats, asig, recargar);
    if (d.reset) { const x = docs.find(y => y.id === d.reset); if (await confirmar({ titulo: 'Restablecer contraseña', texto: `La contraseña de <b>${esc(x.nombres)}</b> volverá a ser su número de documento. También puede recuperarla sola con su correo.`, si: 'Restablecer' })) { try { await usuarios({ accion: 'restablecer', id: x.id }); toast('Contraseña restablecida.'); } catch (er) { toast(errorMsg(er), 'error'); } } }
    if (d.activo) { const x = docs.find(y => y.id === d.activo); if (await confirmar({ titulo: x.activo ? 'Desactivar docente' : 'Activar docente', texto: x.activo ? 'Ya no podrá ingresar. Se conserva su información.' : 'Podrá ingresar de nuevo.', si: x.activo ? 'Desactivar' : 'Activar', peligro: x.activo })) { try { await usuarios({ accion: x.activo ? 'desactivar' : 'activar', id: x.id }); recargar(); } catch (er) { toast(errorMsg(er), 'error'); } } }
  };
}

// ---------- Programar simulacros ----------
async function simulacros({ S, main, recargar }) {
  main.innerHTML = cargando();
  const [grupos, apls, sims, aj] = await Promise.all([cargarGrupos(S).then(L => L.filter(g => g.grado >= 9)), q(sb.from('aplicaciones').select('*').eq('colegio_id', S.perfil.colegio_id).order('inicio', { ascending: false })), q(sb.from('simulacros').select('*').eq('publicado', true).order('id')), q(sb.from('ajustes').select('*'))]);
  const minimo = +(aj.find(x => x.clave === 'tiempo_minimo_min')?.valor ?? 270), recom = +(aj.find(x => x.clave === 'tiempo_recomendado_min')?.valor ?? 360);
  const g = id => grupos.find(x => x.id === id);
  const ahora = new Date();
  main.innerHTML = `${head(`${sims.length} simulacros disponibles`, 'Programar simulacros', `<button class="btn pri" type="button" data-nuevo ${sims.length && grupos.length ? '' : 'disabled'}>${ic('i-cal', 16)}Programar</button>`)}
    ${!sims.length ? `<div class="alert a-info">${ic('i-info')}<div><b>Aún no hay simulacros publicados</b>El administrador de FORTALECER los publica. Cuando estén listos aparecerán aquí.</div></div>` : ''}
    ${!grupos.length ? `<div class="alert a-warn">${ic('i-warn')}<div><b>Su colegio no tiene grupos</b>Créelos en Estudiantes → Grupos.</div></div>` : ''}
    <div class="card">${apls.length ? `<div class="tw"><table><thead><tr><th>Simulacro</th><th>Grupo</th><th>Inicio</th><th>Termina</th><th>Estado</th><th class="r">Acciones</th></tr></thead><tbody>${apls.map(a => { const fin = finDe(a), ini = new Date(a.inicio); const st = ini > ahora ? ['Programado', 'p-info'] : fin > ahora ? ['En curso', 'p-warn'] : ['Terminado', 'p-ok'];
      return `<tr><td><b>Simulacro ${a.simulacro_id}</b></td><td>${esc(grupoTxt(g(a.grupo_id)))}</td><td class="small">${fechaHora(ini)}</td><td class="small">${fechaHora(fin)}</td><td>${pill(st[0], st[1])}</td><td class="r"><div class="row" style="justify-content:flex-end;gap:4px;flex-wrap:nowrap">${fin > ahora ? `<button class="ibtn" type="button" data-editar="${a.id}" title="Cambiar fecha o tiempo">${ic('i-edit', 16)}</button>` : ''}${ini > ahora ? `<button class="ibtn danger" type="button" data-borrar="${a.id}" title="Quitar">${ic('i-trash', 16)}</button>` : ''}</div></td></tr>`; }).join('')}</tbody></table></div>`
      : vacio('i-cal', 'No hay simulacros programados', 'Programe el primero con el botón de arriba.')}
      <p class="xs muted">El tiempo no puede ser menor a ${Math.floor(minimo / 60)} h ${minimo % 60} min (igual al ICFES). Si un simulacro ya empezó, puede ampliar el tiempo desde Inicio → Sala en vivo.</p></div>${corp}`;
  const durOpts = [[270, '4 horas 30 minutos (mínimo)'], [300, '5 horas'], [330, '5 horas 30 minutos'], [360, '6 horas (recomendado)'], [420, '7 horas'], [480, '8 horas']].filter(x => x[0] >= minimo);
  const formulario = (a) => {
    const ini = a ? new Date(a.inicio) : new Date(Date.now() + 86400000);
    const f = x => String(x).padStart(2, '0');
    const fechaV = `${ini.getFullYear()}-${f(ini.getMonth() + 1)}-${f(ini.getDate())}`, horaV = a ? `${f(ini.getHours())}:${f(ini.getMinutes())}` : '07:00';
    return `${a ? '' : selectField('ps', 'Simulacro', sims.map(s => [s.id, s.nombre || 'Simulacro ' + s.id]))}
      <div class="grid g2" style="gap:12px;grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">${field('pf', 'Fecha', fechaV, 'type="date" required')}${field('ph', 'Hora de inicio', horaV, 'type="time" required')}</div>
      ${selectField('pd', 'Tiempo para responder', durOpts, a ? a.duracion_min : recom, 'Si se va la luz o el internet, el estudiante puede volver a entrar mientras no se acabe el tiempo. Cada reingreso queda registrado.')}
      ${a ? '' : `<fieldset style="border:0;padding:0;margin:0;display:grid;gap:8px"><legend style="font:700 13.5px var(--sans);margin-bottom:6px">Grupos</legend><div class="row small">${grupos.filter(x => x.grado >= 9).map(x => `<label class="switch"><input type="checkbox" name="pg" value="${x.id}"> ${esc(grupoTxt(x))}</label>`).join('')}</div></fieldset>`}
      <p class="small muted">Los estudiantes verán su puntaje cuando termine este tiempo.</p>`;
  };
  const leer = () => { const ini = new Date(`${$('#pf').value}T${$('#ph').value}`); return { ini, dur: +$('#pd').value }; };
  main.onclick = async e => {
    const b = e.target.closest('button'); if (!b) return; const d = b.dataset;
    if ('nuevo' in d) {
      const w = modal({ icon: 'i-cal', titulo: 'Programar simulacro', form: true, cuerpo: formulario(null), pie: `<button class="btn sec" type="button" data-cerrar>Cancelar</button><button class="btn pri" type="submit">Guardar programación</button>` });
      w.querySelector('form').onsubmit = async ev => {
        ev.preventDefault(); const { ini, dur } = leer(); const gs = $$('input[name=pg]:checked', w).map(x => x.value);
        if (isNaN(ini)) return toast('Revise la fecha y la hora.', 'error'); if (!gs.length) return toast('Elija al menos un grupo.', 'error');
        const ya = gs.filter(gid => apls.some(a => a.grupo_id === gid && a.simulacro_id === +$('#ps').value));
        if (ya.length) return toast(`El grupo ${grupoTxt(g(ya[0]))} ya tiene programado ese simulacro.`, 'error');
        try { await q(sb.from('aplicaciones').insert(gs.map(gid => ({ simulacro_id: +$('#ps').value, colegio_id: S.perfil.colegio_id, grupo_id: gid, inicio: ini.toISOString(), duracion_min: dur, creado_por: S.perfil.id })))); cerrarModal(); toast('Simulacro programado.'); recargar(); } catch (er) { toast(errorMsg(er), 'error'); }
      };
    }
    if (d.editar) {
      const a = apls.find(x => x.id === d.editar);
      const w = modal({ icon: 'i-edit', titulo: `Simulacro ${a.simulacro_id} · ${esc(grupoTxt(g(a.grupo_id)))}`, sub: 'Cambiar fecha o tiempo', form: true, cuerpo: formulario(a), pie: `<button class="btn sec" type="button" data-cerrar>Cancelar</button><button class="btn pri" type="submit">Guardar cambios</button>` });
      w.querySelector('form').onsubmit = async ev => { ev.preventDefault(); const { ini, dur } = leer(); try { await q(sb.from('aplicaciones').update({ inicio: ini.toISOString(), duracion_min: dur }).eq('id', a.id)); cerrarModal(); toast('Cambios guardados.'); recargar(); } catch (er) { toast(errorMsg(er), 'error'); } };
    }
    if (d.borrar) { if (await confirmar({ titulo: 'Quitar esta programación', texto: 'El simulacro dejará de aparecer para ese grupo.', si: 'Quitar', peligro: true })) { try { await q(sb.from('aplicaciones').delete().eq('id', d.borrar)); toast('Programación quitada.'); recargar(); } catch (er) { toast(errorMsg(er), 'error'); } } }
  };
}

// ---------- Reportes ----------
async function reportes({ S, main, params, go }) {
  if (params[0]) return reporteAplicacion(main, params[0], { rol: 'coordinador', volver: `<div class="row"><button class="btn ghost sm" type="button" data-ir="reportes">← Todos los reportes</button></div>` });
  main.innerHTML = cargando();
  const [grupos, apls] = await Promise.all([cargarGrupos(S), q(sb.from('aplicaciones').select('*').eq('colegio_id', S.perfil.colegio_id).order('inicio', { ascending: false }))]);
  main.innerHTML = `${head(esc(S.colegio.nombre), 'Reportes')}<div class="card"><p class="small muted">Mientras un simulacro está abierto, pulse <b>Ver avance</b> para ver los resultados de los que ya entregaron. Cuando termine el tiempo, verá el <b>Reporte final</b>: promedios por área, niveles, puestos, análisis por pregunta, cuadro de honor, estudiantes en riesgo, sugerencias y boletines para imprimir.</p>${listaAplicaciones(apls, grupos, { avance: true })}</div>
    <div class="card"><div class="row between"><div><span class="lbl">Evolución</span><h2>¿Cómo va cada grupo?</h2></div>${grupos.length ? `<select id="evg" aria-label="Grupo">${grupos.map(x => `<option value="${x.id}">Grupo ${esc(grupoTxt(x))}</option>`).join('')}</select>` : ''}</div><div id="evo">${grupos.length ? cargando() : vacio('i-users', 'Sin grupos')}</div></div>${corp}`;
  const evo = async () => { const el = $('#evo'); if (!el || !$('#evg')) return; el.innerHTML = cargando(); try { el.innerHTML = evolucionHTML(await rpc('evolucion_grupo', { p_grupo: $('#evg').value })); } catch (e) { el.innerHTML = `<div class="alert a-warn">${ic('i-warn')}<div><b>No se pudo cargar la evolución</b>${esc(errorMsg(e))}</div></div>`; } };
  evo();
  main.onchange = e => { if (e.target.id === 'evg') evo(); };
  main.onclick = e => { const b = e.target.closest('[data-rep]'); if (b) go('reportes/' + b.dataset.rep); };
}

// ---------- Materias de cada docente en cada grupo ----------
function materiasDocente(doc, grupos, mats, asig, recargar) {
  const suyas = asig.filter(a => a.docente_id === doc.id);
  const tiene = (g, m) => suyas.some(a => a.grupo_id === g && a.materia_id === m);
  if (!grupos.length) return toast('Primero cree los grupos.', 'error');
  const w = modal({ icon: 'i-teacher', titulo: `Materias de ${esc(doc.nombres)} ${esc(doc.apellidos)}`, sub: 'Marque lo que enseña en cada grupo', ancho: true, form: true,
    cuerpo: `<div class="field"><label for="mgsel">Grupo</label><select id="mgsel">${grupos.map(g => `<option value="${g.id}">${esc(grupoTxt(g))}${suyas.some(a => a.grupo_id === g.id) ? ' ✓' : ''}</option>`).join('')}</select></div>
      <div id="mgbox"></div><p class="xs muted">Puede marcar varias materias por grupo. Para agregar materias nuevas al colegio vaya a Colegio › Períodos, escala y color.</p>`,
    pie: `<button class="btn sec" type="button" data-cerrar>Cerrar</button><button class="btn pri" type="submit">Guardar este grupo</button>`, onClose: recargar });
  const pint = () => { const g = $('#mgsel').value; $('#mgbox').innerHTML = `<div class="row small" style="gap:8px">${mats.map(m => `<label class="switch"><input type="checkbox" name="mm" value="${m.id}" ${tiene(g, m.id) ? 'checked' : ''}> ${esc(m.nombre)}</label>`).join('')}</div>`; };
  pint(); $('#mgsel').onchange = pint;
  w.querySelector('form').onsubmit = async e => {
    e.preventDefault();
    const g = $('#mgsel').value, sel = $$('input[name=mm]:checked', w).map(x => x.value);
    try {
      const quitar = suyas.filter(a => a.grupo_id === g && !sel.includes(a.materia_id));
      for (const a of quitar) await q(sb.from('asignaciones').delete().eq('id', a.id));
      const nuevas = sel.filter(m => !tiene(g, m)).map(m => ({ docente_id: doc.id, grupo_id: g, materia_id: m }));
      if (nuevas.length) await q(sb.from('asignaciones').insert(nuevas));
      quitar.forEach(a => suyas.splice(suyas.indexOf(a), 1)); nuevas.forEach(n => suyas.push(n));
      toast('Materias guardadas. Puede elegir otro grupo.');
      const o = $('#mgsel').selectedOptions[0]; o.textContent = grupoTxt(grupos.find(x => x.id === g)) + (sel.length ? ' ✓' : '');
    } catch (er) { toast(errorMsg(er), 'error'); }
  };
}

// ---------- Exámenes de los docentes ----------
async function examenesColegio({ S, main, go }) {
  main.innerHTML = cargando();
  const L = await rpc('examenes_colegio');
  let fd = '', fm = '';
  const docentes = [...new Set(L.map(x => x.docente))].sort(), materias = [...new Set(L.map(x => x.materia || 'Sin materia'))].sort();
  const pint = () => {
    const F = L.filter(x => (!fd || x.docente === fd) && (!fm || (x.materia || 'Sin materia') === fm));
    const ahora = Date.now();
    $('#exl').innerHTML = F.length ? `<div class="tw"><table><thead><tr><th>Examen</th><th>Docente</th><th>Grupos</th><th class="r">Entregados</th><th class="r">Sospechas</th><th></th></tr></thead><tbody>${F.map(x => { const gs = x.grupos || []; const ab = gs.some(g => new Date(g.apertura) <= ahora && new Date(g.fin) > ahora);
      return `<tr><td><b>${esc(x.titulo)}</b>${x.taller ? ' ' + pill('Taller', 'p-mute') : ''}${ab ? ' ' + pill('Abierto', 'p-ok') : ''}<br><span class="xs muted">${esc(x.materia || 'Sin materia')}${x.periodo ? ' · ' + esc(x.periodo) : ''}</span></td><td class="small">${esc(x.docente)}</td><td class="small">${gs.map(g => `${esc(g.grupo)} (${fecha(g.apertura)})`).join(', ') || '<span class="muted">Sin programar</span>'}</td><td class="r num">${x.entregados}</td><td class="r num" style="${x.sospechas ? 'color:var(--bad);font-weight:800' : ''}">${x.sospechas}</td><td>${gs.length ? `<button class="btn ghost sm" type="button" data-res="${x.id}">Ver</button>` : ''}</td></tr>`; }).join('')}</tbody></table></div>`
      : vacio('i-exam', L.length ? 'No hay exámenes con ese filtro' : 'Los docentes aún no han creado exámenes', 'Cuando un docente programe un examen, aparecerá aquí con sus resultados.');
  };
  main.innerHTML = `${head(esc(S.colegio.nombre), 'Exámenes de los docentes', '', { sub: `${L.length} ${L.length === 1 ? 'examen' : 'exámenes'} en el año. Puede ver los resultados, dar más tiempo o habilitar de nuevo a un estudiante.` })}
    <div class="card"><div class="row"><select id="fd" aria-label="Docente" style="border:1.5px solid var(--line);border-radius:12px;padding:10px;background:var(--surface-2)"><option value="">Todos los docentes</option>${docentes.map(d => `<option>${esc(d)}</option>`).join('')}</select><select id="fm" aria-label="Materia" style="border:1.5px solid var(--line);border-radius:12px;padding:10px;background:var(--surface-2)"><option value="">Todas las materias</option>${materias.map(d => `<option>${esc(d)}</option>`).join('')}</select></div><div id="exl"></div></div>${corp}`;
  pint();
  main.onchange = e => { if (e.target.id === 'fd') fd = e.target.value; if (e.target.id === 'fm') fm = e.target.value; pint(); };
  main.onclick = e => { const b = e.target.closest('[data-res]'); if (b) go('resultados_ex/' + b.dataset.res); };
}

// ---------- Notas del período ----------
async function notasColegio({ S, main, params, go }) {
  main.innerHTML = cargando();
  const [grupos, pers] = await Promise.all([cargarGrupos(S), q(sb.from('periodos').select('*').eq('colegio_id', S.perfil.colegio_id).order('inicio'))]);
  if (!grupos.length) { main.innerHTML = `${head('Notas', 'Notas del período')}<div class="card">${vacio('i-users', 'Aún no hay grupos')}</div>${corp}`; return; }
  const g = params[0] && grupos.some(x => x.id === params[0]) ? params[0] : grupos[0].id;
  await notasGrupoHTML(main, g, params[1] || S.periodo?.id || '', { titulo: 'Notas', grupos, periodos: pers, alCambiar: (a, b) => go(`notas/${a}/${b || ''}`) });
}

// ---------- Boletines del período ----------
async function boletines({ S, main, params, go }) {
  main.innerHTML = cargando();
  const [grupos, pers] = await Promise.all([cargarGrupos(S), q(sb.from('periodos').select('*').eq('colegio_id', S.perfil.colegio_id).order('inicio'))]);
  if (!grupos.length) { main.innerHTML = `${head('Boletines', 'Boletines del período')}<div class="card">${vacio('i-users', 'Aún no hay grupos')}</div>${corp}`; return; }
  const gid = params[0] && grupos.some(x => x.id === params[0]) ? params[0] : grupos[0].id;
  const pid = params[1] || S.periodo?.id || '';
  const B = await rpc('boletines_grupo', { p_grupo: gid, p_periodo: pid || null });
  const N = B.notas, es = N.escala, d = es.decimales, mats = N.materias.sort((a, b) => a.nombre.localeCompare(b.nombre));
  const promE = s => { const v = Object.values(s.notas).map(Number); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  const desemp = n => n == null ? '' : n >= es.min + (es.max - es.min) * .9 ? 'Superior' : n >= es.min + (es.max - es.min) * .75 ? 'Alto' : n >= es.aprobar ? 'Básico' : 'Bajo';
  const conProm = N.estudiantes.map(s => ({ s, p: promE(s) })), orden = [...conProm].filter(x => x.p != null).sort((a, b) => b.p - a.p);
  const puesto = s => orden.findIndex(x => x.s.id === s.id) + 1;
  const hoja = ({ s, p }) => { const sims = B.simulacros.filter(x => x.estudiante_id === s.id), comp = B.competencias[s.id] || [];
    return `<div class="paper"><div class="phd"><div class="row" style="gap:12px;flex-wrap:nowrap">${escudo(B.colegio.escudo_url, B.colegio.nombre, 54)}<div><b style="font-size:15px;color:#141833">${esc(B.colegio.nombre)}</b><div style="font-size:11px;color:#5C6283">${esc(B.colegio.municipio || '')} · Grupo ${esc(B.grupo)}</div></div></div><div style="text-align:right"><div style="font:800 10px sans-serif;letter-spacing:.1em;color:#5C6283">BOLETÍN</div><div style="font:700 13px sans-serif;color:${B.colegio.color}">${B.periodo ? `${esc(B.periodo.nombre)} ${B.periodo.anio}` : 'Año escolar'}</div></div></div>
      <div style="border-top:3px solid ${B.colegio.color};margin:12px 0 14px"></div>
      <div class="row between" style="align-items:flex-start"><div><div style="font:700 22px Georgia,serif;color:#141833">${esc(s.nombre)}</div><div style="font-size:12px;color:#5C6283">Documento ${esc(s.documento || '')}</div></div><div style="text-align:right"><div style="font:700 36px/1 Georgia,serif;color:#141833">${notaTxt(p, d)}</div><div style="font-size:11px;color:#5C6283">promedio${p != null ? ` · puesto ${puesto(s)} de ${orden.length}` : ''}</div></div></div>
      <h3>Notas por materia</h3><table class="pmat"><thead><tr><th>Materia</th><th>Docente</th><th class="r">Nota</th><th>Desempeño</th></tr></thead><tbody>${mats.map(m => `<tr><td>${esc(m.nombre)}</td><td>${esc(B.docentes[m.id] || '')}</td><td class="r"><b style="color:${s.notas[m.id] != null && s.notas[m.id] < es.aprobar ? '#B3261E' : '#141833'}">${notaTxt(s.notas[m.id], d)}</b></td><td>${desemp(s.notas[m.id])}</td></tr>`).join('') || '<tr><td colspan="4">Sin notas en el período</td></tr>'}</tbody></table>
      ${sims.length ? `<h3>Simulacros ICFES</h3><table class="pmat"><thead><tr><th>Simulacro</th>${SHORT.map(x => `<th class="r">${x}</th>`).join('')}<th class="r">Global</th><th class="r">Puesto</th></tr></thead><tbody>${sims.map(x => `<tr><td>${esc(x.simulacro)}</td>${(x.areas || []).map(v => `<td class="r">${v}</td>`).join('')}<td class="r"><b>${x.global}</b></td><td class="r">${x.puesto} de ${x.total}</td></tr>`).join('')}</tbody></table>` : ''}
      ${comp.length ? `<div class="pnote"><b>Para reforzar</b> ${comp.map(c => `${esc(c.competencia)} (${SHORT[c.area]}, ${c.pct}% de aciertos)`).join(' · ')}</div>` : ''}
      <div class="row between" style="margin-top:34px;gap:30px"><div style="flex:1;border-top:1px solid #141833;padding-top:4px;font-size:11px;color:#5C6283">Coordinación</div><div style="flex:1;border-top:1px solid #141833;padding-top:4px;font-size:11px;color:#5C6283">Director de grupo</div><div style="flex:1;border-top:1px solid #141833;padding-top:4px;font-size:11px;color:#5C6283">Acudiente</div></div>
      <div class="pfoot"><span>Escala de ${notaTxt(es.min, d)} a ${notaTxt(es.max, d)} · aprueba con ${notaTxt(es.aprobar, d)}</span><span>Desarrollado por <b>FORTALECER COMPANY</b></span></div></div>`; };
  main.innerHTML = `${head(B.periodo ? `${esc(B.periodo.nombre)} ${B.periodo.anio}` : 'Año escolar', `Boletines · Grupo ${esc(B.grupo)}`, `<div class="field"><label for="bg">Grupo</label><select id="bg">${grupos.map(g => `<option value="${g.id}" ${g.id === gid ? 'selected' : ''}>${esc(grupoTxt(g))}</option>`).join('')}</select></div>${pers.length ? `<div class="field"><label for="bp">Período</label><select id="bp">${pers.map(p => `<option value="${p.id}" ${p.id === (B.periodo?.id) ? 'selected' : ''}>${esc(p.nombre)} ${p.anio}</option>`).join('')}</select></div>` : ''}<button class="btn pri" type="button" data-imp ${N.estudiantes.length ? '' : 'disabled'}>${ic('i-down', 18)}Imprimir boletines</button>`,
      { sub: `${N.estudiantes.length} estudiantes · ${mats.length} materias. Al imprimir puede elegir «Guardar como PDF».` })}
    ${N.estudiantes.length ? `<div class="card"><span class="lbl">Vista previa</span><div style="overflow:auto;background:var(--surface-2);border-radius:18px;padding:18px">${hoja(conProm[0])}</div></div>` : `<div class="card">${vacio('i-users', 'El grupo no tiene estudiantes')}</div>`}${corp}`;
  main.onchange = e => { if (e.target.id === 'bg' || e.target.id === 'bp') go(`boletines/${$('#bg').value}/${$('#bp')?.value || ''}`); };
  main.onclick = e => { if (e.target.closest('[data-imp]')) imprimir(conProm.map(hoja).join(''), `Boletines grupo ${B.grupo}`); };
}

// ---------- Ajustes del colegio: períodos, escala, color y materias ----------
const COLORES = ['#2B3A8C', '#1F6F5C', '#8C1C2B', '#6A2C91', '#0E5E8A', '#9A4A00', '#2F4858', '#14532D', '#7C2D12', '#1E293B'];
async function ajustes({ S, main, recargar }) {
  main.innerHTML = cargando();
  const [pers, mats, col_] = await Promise.all([q(sb.from('periodos').select('*').eq('colegio_id', S.perfil.colegio_id).order('inicio')), q(sb.from('materias').select('*').eq('colegio_id', S.perfil.colegio_id).order('nombre')), q(sb.from('colegios').select('*').eq('id', S.perfil.colegio_id))]);
  const c = col_[0]; let color = c.color;
  const anio = new Date().getFullYear();
  main.innerHTML = `${head(esc(c.nombre), 'Períodos, escala y color', '', { sub: 'Lo que configure aquí lo ven todos los docentes y estudiantes del colegio.' })}
    <div class="bento">
      <div class="card w7"><div class="row between"><div><span class="lbl">Año ${anio}</span><h2>Períodos académicos</h2></div><button class="btn pri sm" type="button" data-nper>${ic('i-plus', 15)}Agregar período</button></div>
        ${pers.length ? `<div class="tw"><table><thead><tr><th>Período</th><th>Desde</th><th>Hasta</th><th></th></tr></thead><tbody>${pers.map(p => `<tr><td><b>${esc(p.nombre)}</b> <span class="xs muted">${p.anio}</span>${S.periodo?.id === p.id ? ' ' + pill('Actual', 'p-ok') : ''}</td><td class="small">${fecha(p.inicio + 'T12:00')}</td><td class="small">${fecha(p.fin + 'T12:00')}</td><td class="r"><button class="ibtn" type="button" data-eper="${p.id}" title="Editar">${ic('i-edit', 16)}</button><button class="ibtn danger" type="button" data-dper="${p.id}" title="Borrar">${ic('i-trash', 16)}</button></td></tr>`).join('')}</tbody></table></div>`
          : `${vacio('i-cal', 'Aún no hay períodos', 'Créelos uno por uno o use el botón para crear 4 períodos de una vez.')}<button class="btn sec sm" type="button" data-cuatro style="justify-self:center">Crear 4 períodos de ${anio}</button>`}
        <p class="xs muted">Cada examen queda en el período en que se crea. Las notas y los boletines se calculan por período.</p></div>
      <div class="card w5" style="gap:14px"><div><span class="lbl">Notas</span><h2>Escala de calificación</h2></div>
        <div class="grid g2" style="gap:10px">${field('emin', 'Nota mínima', c.escala_min, 'type="number" step="0.1"')}${field('emax', 'Nota máxima', c.escala_max, 'type="number" step="0.1"')}${field('eapr', 'Aprueba con', c.nota_aprobar, 'type="number" step="0.1"')}${selectField('edec', 'Decimales', [[0, 'Sin decimales'], [1, 'Un decimal'], [2, 'Dos decimales']], c.decimales)}</div>
        <div class="row" style="gap:6px"><span class="xs muted">Atajos:</span><button class="btn ghost sm" type="button" data-esc="1,5,3,1">1 a 5</button><button class="btn ghost sm" type="button" data-esc="0,10,6,1">0 a 10</button><button class="btn ghost sm" type="button" data-esc="0,100,60,0">0 a 100</button></div>
        <div><span class="lbl">Color del colegio</span><div class="swatches" style="margin-top:8px">${COLORES.map(x => `<button type="button" data-color="${x}" style="--sw:${x}" aria-label="Color ${x}" aria-pressed="${x.toLowerCase() === color.toLowerCase()}"></button>`).join('')}<label class="chk" title="Otro color"><input type="color" id="ocolor" value="${color}"></label></div></div>
        <button class="btn pri" type="button" data-gesc>Guardar escala y color</button></div>
      <div class="card w12"><div class="row between"><div><span class="lbl">${mats.length} materias</span><h2>Materias del colegio</h2></div><div class="row"><input id="nmat" placeholder="Nueva materia" maxlength="60" style="border:1.5px solid var(--line);border-radius:12px;padding:9px 12px;background:var(--surface-2)"><select id="narea" aria-label="Área ICFES" style="border:1.5px solid var(--line);border-radius:12px;padding:9px;background:var(--surface-2)"><option value="">Sin área ICFES</option>${AREAS.map((a, i) => `<option value="${i}">${a}</option>`).join('')}</select><button class="btn pri sm" type="button" data-nmat>Agregar</button></div></div>
        <div class="row" style="gap:8px">${mats.map(m => `<span class="gchip">${esc(m.nombre)}${m.area != null ? ` <small class="muted">· ${SHORT[m.area]}</small>` : ''}<button type="button" data-dmat="${m.id}" aria-label="Quitar ${esc(m.nombre)}">×</button></span>`).join('')}</div>
        <p class="xs muted">El área ICFES de cada materia sirve para el plan de refuerzo de los estudiantes. Quitar una materia borra sus asignaciones; los exámenes quedan sin materia.</p></div>
    </div>${corp}`;
  const periodo = p => {
    const w = modal({ icon: 'i-cal', titulo: p ? 'Editar período' : 'Nuevo período', form: true,
      cuerpo: `<div class="grid g2" style="gap:12px">${field('pn', 'Nombre', p?.nombre || `Período ${pers.length + 1}`, 'required')}${selectField('pnum', 'Número', [1, 2, 3, 4, 5, 6], p?.numero || Math.min(6, pers.length + 1))}${field('pi', 'Desde', p?.inicio || '', 'type="date" required')}${field('pf', 'Hasta', p?.fin || '', 'type="date" required')}</div>`,
      pie: `<button class="btn sec" type="button" data-cerrar>Cancelar</button><button class="btn pri" type="submit">Guardar</button>` });
    w.querySelector('form').onsubmit = async e => {
      e.preventDefault(); const v = { colegio_id: c.id, nombre: $('#pn').value.trim(), numero: +$('#pnum').value, inicio: $('#pi').value, fin: $('#pf').value, anio: +($('#pi').value || '').slice(0, 4) || anio };
      if (!v.nombre || !v.inicio || !v.fin) return toast('Complete el nombre y las fechas.', 'error'); if (v.fin < v.inicio) return toast('La fecha final debe ser después de la inicial.', 'error');
      try { if (p) await q(sb.from('periodos').update(v).eq('id', p.id)); else await q(sb.from('periodos').insert(v)); cerrarModal(); toast('Período guardado.'); recargar(); } catch (er) { toast(/duplicate|unique/i.test(er.message) ? 'Ya existe un período con ese número en ese año.' : errorMsg(er), 'error'); }
    };
  };
  main.onclick = async e => {
    const b = e.target.closest('button'); if (!b) return; const d = b.dataset;
    if ('nper' in d) return periodo(null);
    if (d.eper) return periodo(pers.find(x => x.id === d.eper));
    if (d.dper) { if (!await confirmar({ titulo: '¿Borrar este período?', texto: 'Los exámenes de ese período quedan sin período. Las notas no se borran.', si: 'Borrar', peligro: true })) return; try { await q(sb.from('periodos').delete().eq('id', d.dper)); recargar(); } catch (er) { toast(errorMsg(er), 'error'); } }
    if ('cuatro' in d) {
      const tramos = [['02-01', '04-10'], ['04-11', '06-20'], ['07-07', '09-12'], ['09-13', '11-30']];
      try { await q(sb.from('periodos').insert(tramos.map(([i, f], k) => ({ colegio_id: c.id, anio, numero: k + 1, nombre: `Período ${k + 1}`, inicio: `${anio}-${i}`, fin: `${anio}-${f}` })))); toast('Se crearon 4 períodos. Ajuste las fechas si hace falta.'); recargar(); } catch (er) { toast(errorMsg(er), 'error'); }
    }
    if (d.esc) { const [a, z, ap, dc] = d.esc.split(','); $('#emin').value = a; $('#emax').value = z; $('#eapr').value = ap; $('#edec').value = dc; }
    if (d.color) { color = d.color; $$('.swatches button').forEach(x => x.setAttribute('aria-pressed', x.dataset.color === color)); $('#ocolor').value = color; aplicarColor(color); }
    if ('gesc' in d) {
      const p = { escala_min: +$('#emin').value, escala_max: +$('#emax').value, nota_aprobar: +$('#eapr').value, decimales: +$('#edec').value, color };
      if (!(p.escala_max > p.escala_min) || p.nota_aprobar < p.escala_min || p.nota_aprobar > p.escala_max) return toast('Revise la escala: la máxima debe ser mayor que la mínima y la nota para aprobar debe estar entre las dos.', 'error');
      try { const r = await rpc('colegio_ajustes', { p_colegio: c.id, p }); Object.assign(S.colegio, { color: r.color, escala_min: r.escala_min, escala_max: r.escala_max, nota_aprobar: r.nota_aprobar, decimales: r.decimales }); aplicarColor(r.color); toast('Escala y color guardados.'); } catch (er) { toast(errorMsg(er), 'error'); }
    }
    if ('nmat' in d) { const n = $('#nmat').value.trim(); if (n.length < 2) return toast('Escriba el nombre de la materia.', 'error'); try { await q(sb.from('materias').insert({ colegio_id: c.id, nombre: n, area: $('#narea').value === '' ? null : +$('#narea').value })); toast('Materia agregada.'); recargar(); } catch (er) { toast(errorMsg(er), 'error'); } }
    if (d.dmat) { const m = mats.find(x => x.id === d.dmat); if (!await confirmar({ titulo: `¿Quitar ${esc(m.nombre)}?`, texto: 'Se borran sus asignaciones a docentes. Los exámenes de esa materia quedan sin materia.', si: 'Quitar', peligro: true })) return; try { await q(sb.from('materias').delete().eq('id', m.id)); recargar(); } catch (er) { toast(errorMsg(er), 'error'); } }
  };
  main.oninput = e => { if (e.target.id === 'ocolor') { color = e.target.value; aplicarColor(color); $$('.swatches button').forEach(x => x.setAttribute('aria-pressed', 'false')); } };
}

// ---------- Cierre del año escolar ----------
async function cierre({ S, main, recargar }) {
  main.innerHTML = cargando();
  const R = await rpc('resumen_cierre_anio', {});
  let respaldo = false;
  const fila = (n, t) => `<div class="pend"><div class="cnt"><b>${n}</b></div><div class="tx">${t}</div></div>`;
  main.innerHTML = `${head(`Año ${R.anio}`, 'Cierre del año escolar', '', { sub: 'Úselo una sola vez, cuando termine el año. Primero descargue el respaldo.' })}
    <div class="bento">
      <div class="card w6"><div><span class="lbl">Lo que va a pasar</span><h2>Resumen</h2></div><div style="display:grid;gap:8px">
        ${fila(R.examenes, `exámenes de docentes y sus <b>${R.notas}</b> notas se <b>borran</b>`)}
        ${fila(R.simulacros, `simulacros programados y sus <b>${R.presentados}</b> resultados se <b>borran</b>`)}
        ${fila(R.once, 'cuentas de estudiantes de 11.º se <b>borran</b> (ya se gradúan)')}
        ${fila((R.grupos || []).filter(g => g.grado < 11).reduce((s, g) => s + g.grupos, 0), 'grupos <b>suben un grado</b> con sus estudiantes (por ejemplo, 9-A pasa a 10-A)')}
        ${fila('✓', 'Se conservan los docentes, las materias, la escala, el color y el banco de preguntas de cada docente')}</div></div>
      <div class="card w6" style="gap:14px"><div><span class="lbl">Paso 1</span><h2>Descargar el respaldo</h2></div><p class="small muted">Un Excel con todos los estudiantes, las notas de los exámenes y los resultados de los simulacros del año. Guárdelo en un lugar seguro.</p>
        <button class="btn pri" type="button" data-resp>${ic('i-down', 18)}Descargar respaldo en Excel</button>
        <div><span class="lbl">Paso 2</span><h2>Cerrar el año</h2></div>
        ${R.en_curso ? `<div class="alert a-warn">${ic('i-warn')}<div><b>Hay ${R.en_curso} simulacros o exámenes abiertos ahora</b>Espere a que cierren.</div></div>` : ''}
        ${field('conf', `Para confirmar, escriba el año: ${R.anio}`, '', 'inputmode="numeric" autocomplete="off"')}
        <button class="btn hot" type="button" data-cerrar-anio disabled style="background:var(--bad)">Cerrar el año ${R.anio}</button>
        <p class="xs muted">Esto no se puede deshacer.</p></div>
    </div>${corp}`;
  const habil = () => { $('[data-cerrar-anio]').disabled = !(respaldo && $('#conf').value.trim() === String(R.anio) && !R.en_curso); };
  main.oninput = habil;
  main.onclick = async e => {
    const b = e.target.closest('button'); if (!b) return;
    if ('resp' in b.dataset) {
      try { const X = await rpc('respaldo_anio', {});
        descargarExcel(`respaldo-${X.colegio}-${R.anio}`, {
          Estudiantes: [['Estudiante', 'Documento', 'Grupo', 'Activo'], ...X.estudiantes.map(x => [x.nombre, x.documento, x.grupo, x.activo ? 'Sí' : 'No'])],
          'Notas de exámenes': [['Período', 'Materia', 'Examen', 'Docente', 'Grupo', 'Estudiante', 'Documento', 'Nota'], ...X.examenes.map(x => [x.periodo || '', x.materia || '', x.examen, x.docente, x.grupo, x.nombre, x.documento, x.nota ?? ''])],
          Simulacros: [['Simulacro', 'Fecha', 'Grupo', 'Estudiante', 'Documento', ...SHORT, 'Global'], ...X.simulacros.map(x => [x.simulacro, fecha(x.fecha), x.grupo, x.nombre, x.documento, ...(x.areas || []), x.global])] });
        respaldo = true; habil(); toast('Respaldo descargado. Ya puede cerrar el año.'); } catch (er) { toast(errorMsg(er), 'error'); }
    }
    if ('cerrarAnio' in b.dataset) {
      if (!await confirmar({ titulo: `¿Cerrar el año ${R.anio}?`, texto: 'Se borran los exámenes, las notas, los simulacros y las cuentas de 11.º. Los demás grupos suben un grado. No se puede deshacer.', si: 'Sí, cerrar el año', peligro: true })) return;
      try { const r = await rpc('cerrar_anio', { p_confirmacion: $('#conf').value.trim() }); modal({ icon: 'i-sync', tono: 'ok', titulo: 'Año cerrado', cuerpo: `<p>Se borraron ${r.examenes} exámenes y ${r.simulacros} simulacros, y ${r.cuentas_once} cuentas de 11.º. Subieron de grado ${r.grupos_promovidos} grupos.</p><p class="small muted">Ahora cree los períodos del año nuevo y cargue los estudiantes nuevos.</p>`, pie: '<button class="btn pri" type="button" data-cerrar>Entendido</button>', onClose: recargar }); }
      catch (er) { toast(errorMsg(er), 'error'); }
    }
  };
}

// ---------- Ranking del colegio ----------
async function ranking({ S, main, params, go }) {
  main.innerHTML = cargando();
  const apls = await q(sb.from('aplicaciones').select('simulacro_id,inicio,duracion_min').eq('colegio_id', S.perfil.colegio_id).order('inicio', { ascending: false }));
  const sims = [...new Set(apls.filter(a => finDe(a) < new Date()).map(a => a.simulacro_id))];
  if (!sims.length) { main.innerHTML = `${head('Simulacros ICFES', 'Ranking del colegio')}<div class="card">${vacio('i-trophy', 'Aún no hay simulacros terminados')}</div>${corp}`; return; }
  const sim = +(params[0] || sims[0]);
  const R = await rpc('ranking_colegio', { p_simulacro: sim });
  let fg = '';
  const grados = [...new Set(R.map(x => x.grado))].sort((a, b) => b - a);
  const pint = () => { const L = R.filter(x => !fg || String(x.grado) === fg);
    $('#rk').innerHTML = `<div class="tw"><table><thead><tr><th class="r">Puesto</th><th>Estudiante</th><th>Grupo</th>${SHORT.map(s => `<th class="r">${s}</th>`).join('')}<th class="r">Global</th></tr></thead><tbody>${L.map((x, i) => `<tr><td class="r"><b>${fg ? i + 1 : x.puesto}</b></td><td><b>${esc(x.nombre)}</b></td><td>${esc(x.grupo)} <span class="xs muted">(${x.puesto_grupo}.º)</span></td>${(x.areas || []).map(v => `<td class="r num">${v}</td>`).join('')}<td class="r num"><b>${x.global}</b></td></tr>`).join('')}</tbody></table></div>`; };
  main.innerHTML = `${head('Simulacros ICFES', 'Ranking del colegio', `<div class="field"><label for="rs">Simulacro</label><select id="rs">${sims.map(s => `<option value="${s}" ${s === sim ? 'selected' : ''}>Simulacro ${s}</option>`).join('')}</select></div><div class="field"><label for="rg">Grado</label><select id="rg"><option value="">Todos</option>${grados.map(g => `<option value="${g}">${g}.°</option>`).join('')}</select></div><button class="btn sec" type="button" data-xls>${ic('i-down', 18)}Excel</button>`, { sub: `${R.length} estudiantes presentaron el Simulacro ${sim}.` })}
    <div class="card" id="rk"></div>${corp}`;
  pint();
  main.onchange = e => { if (e.target.id === 'rs') go('ranking/' + e.target.value); if (e.target.id === 'rg') { fg = e.target.value; pint(); } };
  main.onclick = e => { if (e.target.closest('[data-xls]')) descargarExcel(`ranking-simulacro-${sim}`, { Ranking: [['Puesto', 'Estudiante', 'Grupo', 'Puesto en el grupo', ...SHORT, 'Global'], ...R.map(x => [x.puesto, x.nombre, x.grupo, x.puesto_grupo, ...(x.areas || []), x.global])] }); };
}

async function perfilC({ S, main }) {
  const p = S.perfil;
  main.innerHTML = `${head('Mi cuenta', 'Perfil')}<div class="card" style="max-width:560px"><div class="row" style="gap:16px"><span class="av" style="width:64px;height:64px;font-size:20px;border-radius:18px">${esc(iniciales(p.nombres + ' ' + p.apellidos))}</span><div><b style="font-size:19px">${esc(p.nombres)} ${esc(p.apellidos)}</b><br><span class="muted small">${esc(p.email || '')}</span></div></div>
    <div class="row"><button class="btn sec" type="button" data-cambiar-clave>${ic('i-key')}Cambiar contraseña</button><button class="btn ghost" type="button" data-salir>${ic('i-exit')}Cerrar sesión</button></div></div>${corp}`;
}
