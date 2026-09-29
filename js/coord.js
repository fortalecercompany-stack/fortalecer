// FORTALECER · pantallas del coordinador
import { $, $$, esc, ic, AREAS, SHORT, col, soft, aico, chip, toast, errorMsg, modal, cerrarModal, confirmar, head, kpi, cargando, vacio, corp, field, selectField, fecha, fechaHora, hora, pill, iniciales, leerExcel, descargarExcel, normal } from './lib.js';
import { sb, q, rpc, usuarios } from './api.js';
import { reporteAplicacion, listaAplicaciones, evolucionHTML } from './reportes.js';
import { avisosHTML, conectarAvisos } from './avisos.js';

export async function render(ctx) {
  const { seccion } = ctx;
  if (seccion === 'estudiantes') return estudiantes(ctx);
  if (seccion === 'docentes') return docentes(ctx);
  if (seccion === 'simulacros') return simulacros(ctx);
  if (seccion === 'reportes') return reportes(ctx);
  return inicio(ctx);
}

const grupoTxt = g => g ? `${g.grado}-${g.nombre}` : 'Sin grupo';
const ordenG = (a, b) => a.grado - b.grado || a.nombre.localeCompare(b.nombre);
async function cargarGrupos(S) { return (await q(sb.from('grupos').select('*').eq('colegio_id', S.perfil.colegio_id))).sort(ordenG); }
const finDe = a => new Date(new Date(a.inicio).getTime() + a.duracion_min * 60000);

function credenciales(lista, titulo = 'Usuarios creados') {
  modal({ icon: 'i-key', tono: 'ok', titulo, sub: 'Entregue estos datos a cada persona. En el primer ingreso deberá cambiar la contraseña.', ancho: true,
    cuerpo: `<div class="tw"><table><thead><tr><th>Nombre</th><th>Usuario</th><th>Contraseña inicial</th></tr></thead><tbody>${lista.map(c => `<tr><td>${esc(c.nombre)}</td><td class="num"><b>${esc(c.usuario)}</b></td><td class="num">${esc(c.clave)}</td></tr>`).join('')}</tbody></table></div>
      <p class="xs muted">La contraseña inicial es el número de documento. Dirección para ingresar: <b>${esc(location.origin)}</b></p>`,
    pie: `<button class="btn sec" type="button" id="dlcred">${ic('i-down', 15)}Descargar en Excel</button><button class="btn pri" type="button" data-cerrar>Listo</button>` });
  $('#dlcred').onclick = () => descargarExcel('Usuarios FORTALECER', { Usuarios: [['Nombre', 'Usuario', 'Contraseña inicial', 'Dirección'], ...lista.map(c => [c.nombre, c.usuario, c.clave, location.origin])] });
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
  let avHTML = await avisosHTML({ S, gestionar: true });
  const pintar = async () => {
    let sala = '';
    if (sel) {
      const a = enCurso.find(x => x.id === sel);
      let est = [];
      try { est = await rpc('estado_aplicacion', { p_aplicacion: sel }); } catch (e) { toast(errorMsg(e), 'error'); }
      const cuenta = k => est.filter(e => e.estado === k).length;
      const cls = { entrego: 's-done', respondiendo: 's-doing', sin_conexion: 's-off', sin_empezar: 's-not', bloqueado: 's-not', termino_tiempo: 's-done' };
      const txt = { entrego: 'Entregó', respondiendo: 'Respondiendo', sin_conexion: 'Sin conexión', sin_empezar: 'Sin empezar', bloqueado: 'Sin autorización', termino_tiempo: 'Se acabó su tiempo' };
      sala = `<div class="card w8"><div class="row between"><div><span class="lbl">Sala en vivo · se actualiza cada 30 segundos</span><h2>Grupo ${esc(grupoTxt(g(a.grupo_id)))} · Simulacro ${a.simulacro_id}</h2></div>${enCurso.length > 1 ? `<div class="tabs" role="group">${enCurso.map(x => `<button type="button" data-sala="${x.id}" aria-pressed="${x.id === sel}">${esc(grupoTxt(g(x.grupo_id)))}</button>`).join('')}</div>` : ''}</div>
        ${est.length ? `<div class="room"><div class="board" aria-hidden="true"></div><div class="seats">${est.map(e => `<button type="button" class="seat ${cls[e.estado]}" data-est="${e.estudiante_id}" title="${esc(e.nombre)}: ${txt[e.estado]} · ${e.respondidas} respondidas${e.minutos_extra ? ' · +' + e.minutos_extra + ' min' : ''}${e.salidas ? ' · salió ' + e.salidas + ' veces de la ventana' : ''}">${esc(iniciales(e.nombre))}${e.salidas ? `<span class="sal" aria-label="${e.salidas} salidas">${e.salidas}</span>` : ''}</button>`).join('')}</div></div>` : vacio('i-users', 'Este grupo no tiene estudiantes')}
        <div class="legend"><span><i class="l4"></i>Entregó (${cuenta('entrego') + cuenta('termino_tiempo')})</span><span><i style="background:var(--a1)"></i>Respondiendo (${cuenta('respondiendo')})</span><span><i class="l2"></i>Sin conexión (${cuenta('sin_conexion')})</span><span><i style="background:var(--sunk)"></i>Sin empezar (${cuenta('sin_empezar')})</span>${cuenta('bloqueado') ? `<span>${cuenta('bloqueado')} sin autorización</span>` : ''}</div>
        <p class="xs muted">Toque un puesto para ampliar el tiempo o habilitar de nuevo a ese estudiante. El número naranja indica cuántas veces salió de la ventana del simulacro. Termina a las ${hora(finDe(a))}</p>
        <div class="row"><button class="btn sec sm" type="button" data-avance="${a.id}">${ic('i-results', 15)}Ver avance de resultados</button></div></div>`;
      main.dataset.est = JSON.stringify(est.map(e => [e.estudiante_id, e.nombre, e.estado]));
    }
    const total = enCurso.length;
    main.innerHTML = `<div class="bento">
      <section class="hero w12"><div style="display:grid;gap:12px"><span class="eyebrow">${fecha(ahora)}</span><h1>${total ? `${total} ${total === 1 ? 'simulacro en curso' : 'simulacros en curso'}` : 'Hoy no hay simulacros en curso'}</h1><p>${proximas[0] ? `El próximo es el Simulacro ${proximas[0].simulacro_id} para ${esc(grupoTxt(g(proximas[0].grupo_id)))}, el ${fechaHora(proximas[0].inicio)}.` : 'Programe un simulacro para sus grupos cuando quiera.'}</p>
        <div class="row"><button class="btn hot" type="button" data-ir="simulacros">${ic('i-cal')}Programar simulacros</button><button class="btn glass" type="button" data-ir="reportes">${ic('i-results')}Reportes</button></div></div>
        <div class="count"><div><b>${grupos.length}</b><span>grupos</span></div><div><b>${apls.filter(a => finDe(a) < ahora).length}</b><span>aplicados</span></div><div><b>${proximas.length}</b><span>programados</span></div></div></section>
      ${sala}
      <div class="card ${sel ? 'w4' : 'w12'}" style="gap:12px"><span class="lbl">Pendientes</span>
        ${pend.count ? `<div class="alert a-warn">${ic('i-warn')}<div><b>${pend.count} estudiantes sin autorización del acudiente</b>No pueden presentar simulacros. <button class="linkbtn" type="button" data-ir="estudiantes">Revisar</button></div></div>` : `<div class="alert a-ok">${ic('i-sync')}<div><b>Todas las autorizaciones al día</b></div></div>`}
        ${grupos.length ? '' : `<div class="alert a-info">${ic('i-info')}<div><b>Su colegio aún no tiene grupos</b>Créelos en Estudiantes → Grupos.</div></div>`}
        ${proximas.slice(0, 3).map(a => `<div class="alert a-info">${ic('i-cal')}<div><b>Simulacro ${a.simulacro_id} · ${esc(grupoTxt(g(a.grupo_id)))}</b>${fechaHora(a.inicio)} · ${Math.round(a.duracion_min / 60 * 10) / 10} horas</div></div>`).join('')}</div>
      ${avHTML}
    </div>${corp}`;
    conectarAvisos(main, { S, alCambiar: async () => { avHTML = await avisosHTML({ S, gestionar: true }); pintar(); } });
  };
  await pintar();
  vivo = setInterval(() => { if (!document.body.contains(main) || location.hash !== '#/inicio') return clearInterval(vivo); if (sel && !$('#modalbox').innerHTML) pintar(); }, 30000);
  main.onclick = async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.sala) { sel = b.dataset.sala; pintar(); }
    if (b.dataset.avance) go('reportes/' + b.dataset.avance);
    if (b.dataset.est) accionesEstudiante(sel, b.dataset.est, JSON.parse(main.dataset.est || '[]').find(x => x[0] === b.dataset.est), pintar);
  };
}
function accionesEstudiante(apl, estId, info, despues) {
  const w = modal({ icon: 'i-user', titulo: esc(info?.[1] || 'Estudiante'), sub: 'Ajustes para este simulacro', form: true,
    cuerpo: `${selectField('mins', 'Ampliar tiempo', [[30, '30 minutos'], [60, '1 hora'], [120, '2 horas']], 60, 'Úselo si hubo problemas de luz o de conexión. Conserva sus respuestas.')}
      ${info?.[2] === 'entrego' ? `<div class="alert a-info">${ic('i-info')}<div><b>Ya entregó</b>Si lo necesita, puede habilitarlo de nuevo para que siga respondiendo.</div></div>` : ''}`,
    pie: `${info?.[2] === 'entrego' ? `<button class="btn sec" type="button" id="reabrir">Habilitar de nuevo</button>` : ''}<button class="btn sec" type="button" data-cerrar>Cancelar</button><button class="btn pri" type="submit">Ampliar tiempo</button>` });
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
    cuerpo: `<div class="gradelist">${[9, 10, 11].map(k => `<div class="graderow"><b style="min-width:90px">Grado ${k}.°</b><div class="row" style="gap:6px;flex:1">${grupos.filter(g => g.grado === k).map(g => `<span class="gchip">${k}-${esc(g.nombre)} <small class="muted">(${cuenta(g.id)})</small><button type="button" data-rmg="${g.id}" aria-label="Quitar grupo">×</button></span>`).join('') || '<span class="xs muted">Sin grupos</span>'}</div></div>`).join('')}</div>
      <div class="grid g2" style="gap:12px;align-items:end">${selectField('ngr', 'Grado', [9, 10, 11], 11)}${field('nno', 'Nombre del grupo', '', 'maxlength="6" placeholder="A, B, 01…"')}</div>`,
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
  const [grupos, docs, dg] = await Promise.all([cargarGrupos(S), q(sb.from('perfiles').select('*').eq('colegio_id', S.perfil.colegio_id).eq('rol', 'docente').order('apellidos')), q(sb.from('docente_grupos').select('*'))]);
  const gruposDe = id => dg.filter(x => x.docente_id === id).map(x => grupos.find(g => g.id === x.grupo_id)).filter(Boolean).sort(ordenG);
  main.innerHTML = `${head(esc(S.colegio.nombre), 'Docentes', `<button class="btn pri" type="button" data-nuevo>+ Agregar docente</button>`)}
    <div class="card">${docs.length ? `<div class="tw"><table><thead><tr><th>Docente</th><th>Área</th><th>Grupos</th><th>Estado</th><th class="r">Acciones</th></tr></thead><tbody>${docs.map(d => `<tr><td><div class="row" style="gap:10px;flex-wrap:nowrap"><span class="av" style="width:34px;height:34px;font-size:11px;border-radius:10px;background:${d.area != null ? col(d.area) : 'var(--brand)'}">${esc(iniciales(d.nombres + ' ' + d.apellidos))}</span><div><b class="small">${esc(d.nombres)} ${esc(d.apellidos)}</b><div class="xs muted">${esc(d.email)}</div></div></div></td>
      <td>${d.area != null ? chip(d.area) : ''}${d.componente ? `<div class="xs muted">${esc(d.componente)}</div>` : ''}</td><td class="small">${gruposDe(d.id).map(grupoTxt).join(', ') || '—'}</td><td>${d.activo ? (d.debe_cambiar_clave ? pill('No ha ingresado', 'p-warn') : pill('Activo', 'p-ok')) : pill('Inactivo')}</td>
      <td class="r"><div class="row" style="justify-content:flex-end;gap:4px;flex-wrap:nowrap"><button class="ibtn" type="button" data-grp="${d.id}" title="Cambiar grupos">${ic('i-school', 16)}</button><button class="ibtn" type="button" data-reset="${d.id}" title="Restablecer contraseña">${ic('i-key', 16)}</button><button class="ibtn ${d.activo ? 'danger' : ''}" type="button" data-activo="${d.id}" title="${d.activo ? 'Desactivar' : 'Activar'}">${ic(d.activo ? 'i-exit' : 'i-sync', 16)}</button></div></td></tr>`).join('')}</tbody></table></div>`
    : vacio('i-teacher', 'Todavía no hay docentes', 'Agregue a cada docente con su correo; recibirá un usuario para ver los reportes de su área.')}
    <p class="xs muted">Los docentes ven solo los reportes de su área y sus grupos. Si olvidan la contraseña, la recuperan con su correo.</p></div>${corp}`;
  const checks = sel => `<fieldset style="border:0;padding:0;margin:0;display:grid;gap:8px"><legend style="font:700 13.5px var(--sans);margin-bottom:6px">Grupos a su cargo</legend><div class="row small">${grupos.map(g => `<label class="switch"><input type="checkbox" name="gr" value="${g.id}" ${sel.includes(g.id) ? 'checked' : ''}> ${esc(grupoTxt(g))}</label>`).join('') || '<span class="muted">Primero cree los grupos en Estudiantes.</span>'}</div></fieldset>`;
  main.onclick = async e => {
    const b = e.target.closest('button'); if (!b) return; const d = b.dataset;
    if ('nuevo' in d) {
      const w = modal({ icon: 'i-teacher', titulo: 'Agregar docente', sub: 'Usuario: su correo · contraseña inicial: su documento', form: true, ancho: true,
        cuerpo: `<div class="grid" style="gap:12px;align-items:start;grid-template-columns:repeat(auto-fit,minmax(200px,1fr))">${field('dn', 'Nombres', '', 'required')}${field('da', 'Apellidos', '', 'required')}${field('dd', 'Número de documento', '', 'required inputmode="numeric"')}${field('de', 'Correo', '', 'type="email" required', 'Puede ser Gmail, Hotmail u otro.')}${selectField('dar', 'Área que enseña', AREAS.map((a, i) => [i, a]), 1)}<div class="field" id="compbox" hidden>${selectField('dc', 'Componente de Ciencias', ['Biología', 'Química', 'Física', 'Química y Física', 'Ciencia, tecnología y sociedad'])}</div></div>${checks([])}`,
        pie: `<button class="btn sec" type="button" data-cerrar>Cancelar</button><button class="btn pri" type="submit" id="gbtn">Guardar docente</button>` });
      $('#dar').onchange = () => { $('#compbox').hidden = $('#dar').value !== '3'; };
      w.querySelector('form').onsubmit = async ev => {
        ev.preventDefault();
        const p = { rol: 'docente', nombres: $('#dn').value.trim(), apellidos: $('#da').value.trim(), documento: $('#dd').value.replace(/\D/g, ''), email: $('#de').value.trim(), area: +$('#dar').value, componente: $('#dar').value === '3' ? $('#dc').value : null, grupos: $$('input[name=gr]:checked', w).map(x => x.value) };
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
    if (d.reset) { const x = docs.find(y => y.id === d.reset); if (await confirmar({ titulo: 'Restablecer contraseña', texto: `La contraseña de <b>${esc(x.nombres)}</b> volverá a ser su número de documento. También puede recuperarla sola con su correo.`, si: 'Restablecer' })) { try { await usuarios({ accion: 'restablecer', id: x.id }); toast('Contraseña restablecida.'); } catch (er) { toast(errorMsg(er), 'error'); } } }
    if (d.activo) { const x = docs.find(y => y.id === d.activo); if (await confirmar({ titulo: x.activo ? 'Desactivar docente' : 'Activar docente', texto: x.activo ? 'Ya no podrá ingresar. Se conserva su información.' : 'Podrá ingresar de nuevo.', si: x.activo ? 'Desactivar' : 'Activar', peligro: x.activo })) { try { await usuarios({ accion: x.activo ? 'desactivar' : 'activar', id: x.id }); recargar(); } catch (er) { toast(errorMsg(er), 'error'); } } }
  };
}

// ---------- Programar simulacros ----------
async function simulacros({ S, main, recargar }) {
  main.innerHTML = cargando();
  const [grupos, apls, sims, aj] = await Promise.all([cargarGrupos(S), q(sb.from('aplicaciones').select('*').eq('colegio_id', S.perfil.colegio_id).order('inicio', { ascending: false })), q(sb.from('simulacros').select('*').eq('publicado', true).order('id')), q(sb.from('ajustes').select('*'))]);
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
      ${selectField('pd', 'Tiempo para responder', durOpts, a ? a.duracion_min : recom, 'Los estudiantes pueden entrar y salir mientras no se acabe el tiempo.')}
      ${a ? '' : `<fieldset style="border:0;padding:0;margin:0;display:grid;gap:8px"><legend style="font:700 13.5px var(--sans);margin-bottom:6px">Grupos</legend><div class="row small">${grupos.map(x => `<label class="switch"><input type="checkbox" name="pg" value="${x.id}"> ${esc(grupoTxt(x))}</label>`).join('')}</div></fieldset>`}
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
