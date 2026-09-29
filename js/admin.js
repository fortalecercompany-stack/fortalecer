// FORTALECER · pantallas del administrador (y de soporte, en modo consulta)
import { $, $$, esc, ic, AREAS, SHORT, col, soft, aico, chip, toast, errorMsg, modal, cerrarModal, confirmar, head, kpi, cargando, vacio, corp, field, selectField, fecha, fechaHora, pill, iniciales, escudo, heat, lvLegend, barra, descargarExcel, leerExcel, normal, num } from './lib.js';
import { sb, q, rpc, usuarios, subirArchivo } from './api.js';
import { reporteAplicacion, listaAplicaciones } from './reportes.js';
import { avisosHTML, conectarAvisos } from './avisos.js';

let ADMIN = false;
export async function render(ctx) {
  ADMIN = ctx.S.perfil.rol === 'admin';
  const s = ctx.seccion;
  if (s === 'colegios') return ctx.params[0] ? colegioDetalle(ctx) : colegios(ctx);
  if (s === 'preguntas') return preguntas(ctx);
  if (s === 'simulacros') return simulacros(ctx);
  if (s === 'reportes') return reportes(ctx);
  if (s === 'usuarios') return usuariosPantalla(ctx);
  return inicio(ctx);
}
const grupoTxt = g => g ? `${g.grado}-${g.nombre}` : '';
const ESTADOS = ['Lista', 'Por revisar', 'Repetida', 'Retirada'];
const estPill = e => pill(e, { 'Lista': 'p-ok', 'Por revisar': 'p-warn', 'Repetida': 'p-mute', 'Retirada': 'p-bad' }[e] || 'p-mute');

function credenciales(lista, titulo) {
  modal({ icon: 'i-key', tono: 'ok', titulo, sub: 'Entregue estos datos. En el primer ingreso deberá cambiar la contraseña.', ancho: true,
    cuerpo: `<div class="tw"><table><thead><tr><th>Nombre</th><th>Usuario</th><th>Contraseña inicial</th></tr></thead><tbody>${lista.map(c => `<tr><td>${esc(c.nombre)}</td><td><b>${esc(c.usuario)}</b></td><td class="num">${esc(c.clave)}</td></tr>`).join('')}</tbody></table></div><p class="xs muted">Dirección para ingresar: <b>${esc(location.origin)}</b></p>`,
    pie: `<button class="btn pri" type="button" data-cerrar>Listo</button>` });
}

// ---------- Inicio ----------
async function inicio({ S, main, recargar }) {
  main.innerHTML = cargando();
  const [r, avHTML, cols] = await Promise.all([rpc('resumen_admin'), avisosHTML({ S, gestionar: ADMIN }), ADMIN ? q(sb.from('colegios').select('id,nombre').order('nombre')) : []]);
  const pr = r.preguntas || {};
  const minArea = Math.min(...r.por_area.map(a => a.listas));
  main.innerHTML = `<div class="bento">
    <section class="hero w12"><div style="display:grid;gap:12px"><span class="eyebrow">Panel general · ${fecha(new Date())}</span><h1>${r.aplicaciones_hoy ? `Hoy hay ${r.aplicaciones_hoy} simulacros en curso.` : 'Bienvenido al panel de FORTALECER.'}</h1><p>${num(r.colegios)} colegios, ${num(r.estudiantes)} estudiantes y ${num((pr['Lista'] || 0) + (pr['Por revisar'] || 0))} preguntas distintas en el banco.</p>
      <div class="row">${ADMIN ? `<button class="btn hot" type="button" data-ir="colegios">${ic('i-school')}Colegios</button>` : ''}<button class="btn glass" type="button" data-ir="reportes">${ic('i-results')}Reportes globales</button></div></div>
      <div class="count"><div><b>${r.colegios_activos}</b><span>colegios activos</span></div><div><b>${num(r.estudiantes)}</b><span>estudiantes</span></div><div><b>${num(r.intentos)}</b><span>simulacros presentados</span></div></div></section>
    ${!r.colegios ? `<div class="card w12"><div class="alert a-info">${ic('i-info')}<div><b>Primeros pasos</b>1) Cargue el banco inicial en <b>Preguntas</b>. 2) Arme y publique los simulacros en <b>Simulacros</b>. 3) Cree el primer colegio con su coordinador en <b>Colegios</b>.</div></div></div>` : ''}
    <div class="card w7"><div class="row between"><div><span class="lbl">Banco de preguntas</span><h2>Preguntas listas por área</h2></div><span class="pill p-brand">Alcanzan para ${Math.floor(minArea / 25)} simulacros</span></div>
      <div style="display:grid;gap:12px">${r.por_area.map(a => `<div style="display:grid;grid-template-columns:120px minmax(0,1fr) 110px;gap:10px;align-items:center"><span class="row" style="gap:8px;flex-wrap:nowrap">${aico(a.area, 28)}<b class="small">${SHORT[a.area]}</b></span>${barra(a.listas, col(a.area), 500)}<span class="xs muted num" style="text-align:right"><b>${a.listas}</b> listas · ${a.revisar} por revisar</span></div>`).join('')}</div>
      <p class="xs muted">Para 20 simulacros se necesitan 500 por área (25 por simulacro).</p></div>
    <div class="card w5" style="gap:12px"><span class="lbl">Atención</span>
      ${pr['Por revisar'] ? `<div class="alert a-warn">${ic('i-bank')}<div><b>${num(pr['Por revisar'])} preguntas por revisar</b>Tienen figuras, tablas o símbolos que hay que comparar con el cuadernillo.</div></div>` : ''}
      ${r.sin_autorizacion ? `<div class="alert a-warn">${ic('i-users')}<div><b>${r.sin_autorizacion} estudiantes sin autorización del acudiente</b></div></div>` : ''}
      <div class="alert a-info">${ic('i-users')}<div><b>${r.coordinadores} coordinadores · ${r.docentes} docentes</b></div></div></div>
    <div class="card w12"><div><span class="lbl">Registro de actividad</span><h2>Quién hizo qué</h2></div>
      ${r.actividad.length ? `<div class="log">${r.actividad.map(l => `<div class="logi"><span class="aico" style="width:36px;height:36px;background:var(--surface-2);color:var(--brand)">${ic('i-sync', 17)}</span><div><span class="small"><b>${esc(l.usuario)}</b> ${esc(l.accion)}${l.detalle ? ` · ${esc(l.detalle)}` : ''}</span><div class="xs muted">${fechaHora(l.creado_en)}</div></div></div>`).join('')}</div>` : vacio('i-sync', 'Sin actividad todavía')}</div>
    ${avHTML}
  </div>${corp}`;
  conectarAvisos(main, { S, colegios: cols, alCambiar: recargar });
}

// ---------- Colegios ----------
async function colegios({ main, go, recargar }) {
  main.innerHTML = cargando();
  const [cols, grupos, perf] = await Promise.all([q(sb.from('colegios').select('*').order('nombre')), q(sb.from('grupos').select('*')), q(sb.from('perfiles').select('colegio_id,rol').in('rol', ['coordinador', 'estudiante']))]);
  const gr = id => grupos.filter(g => g.colegio_id === id).sort((a, b) => a.grado - b.grado || a.nombre.localeCompare(b.nombre));
  const n = (id, rol) => perf.filter(p => p.colegio_id === id && p.rol === rol).length;
  main.innerHTML = `${head('Administración', 'Colegios', ADMIN ? `<button class="btn pri" type="button" data-nuevo>+ Crear colegio</button>` : '')}
    <div class="grid g4">${kpi('i-school', 'var(--brand)', 'var(--brand-soft)', cols.length, 'colegios')}${kpi('i-sync', 'var(--ok)', 'var(--ok-soft)', cols.filter(c => c.activo).length, 'activos')}${kpi('i-users', 'var(--a3)', 'var(--a3s)', perf.filter(p => p.rol === 'estudiante').length, 'estudiantes')}${kpi('i-teacher', 'var(--a4)', 'var(--a4s)', perf.filter(p => p.rol === 'coordinador').length, 'coordinadores')}</div>
    ${cols.length ? `<div class="grid g3">${cols.map(c => `<div class="card lift"><div class="row between">${escudo(c.escudo_url, c.nombre, 52)}${c.activo ? pill('Activo', 'p-ok') : pill('Inactivo')}</div><div><h3>${esc(c.nombre)}</h3><p class="xs muted">${esc([c.municipio, c.departamento].filter(Boolean).join(', '))}</p></div>
      <div class="row" style="gap:6px">${gr(c.id).map(g => `<span class="pill p-brand">${esc(grupoTxt(g))}</span>`).join('') || pill('Sin grupos')}</div>
      <div class="row between"><span class="small"><b>${n(c.id, 'estudiante')}</b> estudiantes · <b>${n(c.id, 'coordinador')}</b> coord.</span><button class="btn pri sm" type="button" data-abrir="${c.id}">Abrir</button></div></div>`).join('')}</div>`
      : `<div class="card">${vacio('i-school', 'Todavía no hay colegios', 'Cree el primero con su escudo, grupos y coordinador.', ADMIN ? `<button class="btn pri" type="button" data-nuevo>+ Crear colegio</button>` : '')}</div>`}
    <p class="xs muted">Un colegio inactivo pierde el acceso, pero su información se conserva.</p>${corp}`;
  main.onclick = e => { const b = e.target.closest('button'); if (!b) return; if ('nuevo' in b.dataset) asistenteColegio(null, [], recargar); if (b.dataset.abrir) go('colegios/' + b.dataset.abrir); };
}

function asistenteColegio(c, gruposActuales, alTerminar) {
  const d = { nombre: c?.nombre || '', dane: c?.dane || '', municipio: c?.municipio || '', departamento: c?.departamento || '', sede: c?.sede || 'Sede principal', escudo_url: c?.escudo_url || null, archivo: null,
    grados: { 9: [], 10: [], 11: [] }, cn: '', ca: '', ce: '', cd: '' };
  gruposActuales.forEach(g => d.grados[g.grado].push({ id: g.id, nombre: g.nombre }));
  if (!c) d.grados = { 9: [], 10: [{ nombre: 'A' }], 11: [{ nombre: 'A' }] };
  const borrados = [];
  let paso = 0; const pasos = c ? ['Colegio y escudo', 'Grados y grupos'] : ['Colegio y escudo', 'Grados y grupos', 'Coordinador'];
  const guardarCampos = () => { ['nombre', 'dane', 'municipio', 'departamento', 'sede', 'cn', 'ca', 'ce', 'cd'].forEach(k => { const el = $('#w-' + k); if (el) d[k] = el.value.trim(); }); };
  const f = (k, l, extra = '', hint = '') => field('w-' + k, l, d[k], extra, hint);
  const pintar = () => {
    const stepper = `<ol class="stepper">${pasos.map((t, i) => `<li class="${i < paso ? 'done' : i === paso ? 'on' : ''}"><span>${i < paso ? '✓' : i + 1}</span>${t}</li>`).join('')}</ol>`;
    let cuerpo = '';
    if (paso === 0) cuerpo = `<div class="crestup"><div class="prev">${d.escudo_url ? `<img src="${esc(d.escudo_url)}" alt="Escudo">` : `<span class="ph">${ic('i-school', 34)}<small>Sin escudo</small></span>`}</div>
        <div style="display:grid;gap:8px;align-content:center"><b>Escudo del colegio</b><span class="xs muted">Imagen PNG o JPG, idealmente cuadrada. Aparece en todas las pantallas del colegio y en los boletines.</span>
        <div class="row"><label class="btn sec sm" for="w-file">${ic('i-upload', 15)}Subir escudo</label><input id="w-file" type="file" accept="image/png,image/jpeg,image/webp" hidden>${d.escudo_url ? `<button class="btn ghost sm" type="button" id="w-rm">Quitar</button>` : ''}</div></div></div>
      <div class="grid" style="gap:12px;align-items:start;grid-template-columns:repeat(auto-fit,minmax(210px,1fr))">${f('nombre', 'Nombre del colegio', 'required')}${f('dane', 'Código DANE', 'inputmode="numeric"', 'Opcional.')}${f('municipio', 'Municipio')}${f('departamento', 'Departamento')}${f('sede', 'Sede')}</div>`;
    if (paso === 1) cuerpo = `<p class="small muted">Cree los grupos de cada grado. El coordinador también puede crearlos o cambiarlos después.</p><div class="gradelist">${[9, 10, 11].map(k => `<div class="graderow"><b style="min-width:90px;font-size:16px">Grado ${k}.°</b><div class="row" style="gap:6px;flex:1">${d.grados[k].map((x, i) => `<span class="gchip">${k}-${esc(x.nombre)}<button type="button" data-rmg="${k}:${i}" aria-label="Quitar grupo">×</button></span>`).join('') || '<span class="xs muted">Sin grupos</span>'}<button class="btn sec sm" type="button" data-addg="${k}">+ Grupo</button></div></div>`).join('')}</div>`;
    if (paso === 2) cuerpo = `<div class="grid" style="gap:12px;align-items:start;grid-template-columns:repeat(auto-fit,minmax(210px,1fr))">${f('cn', 'Nombres del coordinador', 'required')}${f('ca', 'Apellidos', 'required')}${f('ce', 'Correo', 'type="email" required', 'Será su usuario.')}${f('cd', 'Número de documento', 'inputmode="numeric" required', 'Será su contraseña inicial.')}</div>
      <div class="alert a-info">${ic('i-info')}<div><b>Al crear el colegio verá el usuario y la contraseña del coordinador</b>para entregárselos. Puede agregar más coordinadores después.</div></div>`;
    const pie = `${paso ? `<button class="btn sec" type="button" id="w-atras">← Atrás</button>` : `<button class="btn sec" type="button" data-cerrar>Cancelar</button>`}${paso < pasos.length - 1 ? `<button class="btn pri" type="button" id="w-sig">Siguiente →</button>` : `<button class="btn hot" type="button" id="w-fin" style="font-size:14.5px;padding:12px 20px">${c ? 'Guardar cambios' : 'Crear colegio'}</button>`}`;
    const w = modal({ icon: 'i-school', titulo: c ? 'Editar colegio' : 'Crear colegio', sub: `Paso ${paso + 1} de ${pasos.length} · ${pasos[paso]}`, cuerpo: stepper + cuerpo, pie, ancho: true });
    const fi = $('#w-file'); if (fi) fi.onchange = () => { const file = fi.files[0]; if (!file) return; if (file.size > 2e6) return toast('La imagen pesa más de 2 MB. Use una más liviana.', 'error'); guardarCampos(); d.archivo = file; d.escudo_url = URL.createObjectURL(file); pintar(); };
    const rm = $('#w-rm'); if (rm) rm.onclick = () => { guardarCampos(); d.archivo = null; d.escudo_url = null; pintar(); };
    const at = $('#w-atras'); if (at) at.onclick = () => { guardarCampos(); paso--; pintar(); };
    const sg = $('#w-sig'); if (sg) sg.onclick = () => { guardarCampos(); if (paso === 0 && !d.nombre) return toast('Escriba el nombre del colegio.', 'error'); paso++; pintar(); };
    w.onclick = e => { const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.addg) { const L = d.grados[b.dataset.addg]; const letras = 'ABCDEFGHIJKL'; const usadas = L.map(x => x.nombre); L.push({ nombre: [...letras].find(l => !usadas.includes(l)) || String(L.length + 1) }); pintar(); }
      if (b.dataset.rmg) { const [k, i] = b.dataset.rmg.split(':'); const x = d.grados[k].splice(+i, 1)[0]; if (x.id) borrados.push(x.id); pintar(); } };
    const fin = $('#w-fin'); if (fin) fin.onclick = async () => {
      guardarCampos();
      if (!c && (!d.cn || !d.ca || !d.ce.includes('@') || d.cd.replace(/\D/g, '').length < 5)) return toast('Complete los datos del coordinador con un correo válido.', 'error');
      fin.disabled = true; fin.textContent = 'Guardando…';
      try {
        let url = d.archivo ? await subirArchivo('escudos', d.archivo, normal(d.nombre).replace(/[^a-z0-9]+/g, '-').slice(0, 40)) : d.escudo_url;
        const datos = { nombre: d.nombre, dane: d.dane || null, municipio: d.municipio, departamento: d.departamento, sede: d.sede, escudo_url: url };
        let colegio;
        if (c) colegio = (await q(sb.from('colegios').update(datos).eq('id', c.id).select().single()));
        else if (d.creado) colegio = d.creado; // reintento: el colegio ya quedó guardado
        else { colegio = await q(sb.from('colegios').insert(datos).select().single()); d.creado = colegio; }
        const nuevos = [9, 10, 11].flatMap(k => d.grados[k].filter(x => !x.id).map(x => ({ colegio_id: colegio.id, grado: k, nombre: x.nombre })));
        if (nuevos.length && !d.gruposListos) { await q(sb.from('grupos').insert(nuevos)); if (!c) d.gruposListos = true; }
        for (const id of borrados) { const { error } = await sb.from('grupos').delete().eq('id', id); if (error) toast('Un grupo con estudiantes no se pudo quitar.', 'error'); }
        let cred = null;
        if (!c) cred = await usuarios({ accion: 'crear', persona: { rol: 'coordinador', nombres: d.cn, apellidos: d.ca, email: d.ce, documento: d.cd.replace(/\D/g, ''), colegio_id: colegio.id } });
        cerrarModal(); toast(c ? 'Cambios guardados.' : `${d.nombre} creado.`);
        if (cred) credenciales([cred], 'Coordinador creado');
        alTerminar();
      } catch (e) { fin.disabled = false; fin.textContent = 'Reintentar'; toast(errorMsg(e), 'error'); }
    };
  };
  pintar();
}

async function colegioDetalle({ S, main, params, go, recargar }) {
  main.innerHTML = cargando();
  const id = params[0];
  const [c, grupos, perf, apls] = await Promise.all([q(sb.from('colegios').select('*').eq('id', id).single()), q(sb.from('grupos').select('*').eq('colegio_id', id)), q(sb.from('perfiles').select('*').eq('colegio_id', id)), q(sb.from('aplicaciones').select('*').eq('colegio_id', id).order('inicio', { ascending: false }))]);
  grupos.sort((a, b) => a.grado - b.grado || a.nombre.localeCompare(b.nombre));
  const coords = perf.filter(p => p.rol === 'coordinador'), est = perf.filter(p => p.rol === 'estudiante'), docs = perf.filter(p => p.rol === 'docente');
  main.innerHTML = `<div class="row"><button class="btn ghost sm" type="button" data-ir="colegios">← Colegios</button></div>
    <section class="hero" style="grid-template-columns:auto minmax(0,1fr) auto"><div style="background:#fff;border-radius:22px;padding:10px;width:96px;height:96px;display:grid;place-items:center">${escudo(c.escudo_url, c.nombre, 76)}</div>
      <div style="display:grid;gap:8px"><span class="eyebrow">${c.activo ? 'Activo' : 'Inactivo'} · ${esc([c.municipio, c.departamento].filter(Boolean).join(', '))}</span><h1>${esc(c.nombre)}</h1><p>${esc(c.sede || '')}${c.dane ? ' · DANE ' + esc(c.dane) : ''}</p></div>
      ${ADMIN ? `<div class="row"><button class="btn glass" type="button" data-editar>${ic('i-edit', 16)}Editar</button><button class="btn glass" type="button" data-activo>${c.activo ? 'Desactivar' : 'Activar'}</button></div>` : ''}</section>
    <div class="grid g4">${kpi('i-users', 'var(--brand)', 'var(--brand-soft)', est.length, 'estudiantes')}${kpi('i-school', 'var(--a3)', 'var(--a3s)', grupos.length, 'grupos')}${kpi('i-teacher', 'var(--a4)', 'var(--a4s)', docs.length, 'docentes')}${kpi('i-exam', 'var(--a2)', 'var(--a2s)', apls.length, 'simulacros programados')}</div>
    <div class="bento">
      <div class="card w6"><div><span class="lbl">Grados y grupos</span><h2>${grupos.length} grupos</h2></div><div class="tw"><table><thead><tr><th>Grupo</th><th class="r">Estudiantes</th><th class="r">Sin autorización</th></tr></thead><tbody>${grupos.map(g => `<tr><td><b>${esc(grupoTxt(g))}</b></td><td class="r num">${est.filter(e => e.grupo_id === g.id).length}</td><td class="r num">${est.filter(e => e.grupo_id === g.id && !e.autorizacion_acudiente).length}</td></tr>`).join('') || `<tr><td colspan="3" class="muted">Sin grupos</td></tr>`}</tbody></table></div></div>
      <div class="card w6"><div class="row between"><div><span class="lbl">Coordinación</span><h2>${coords.length} coordinador(es)</h2></div>${ADMIN ? `<button class="btn sec sm" type="button" data-coord>+ Agregar</button>` : ''}</div>
        ${coords.map(p => `<div class="row" style="gap:10px;flex-wrap:nowrap"><span class="av" style="width:36px;height:36px;font-size:12px;border-radius:11px">${esc(iniciales(p.nombres + ' ' + p.apellidos))}</span><div style="flex:1"><b class="small">${esc(p.nombres)} ${esc(p.apellidos)}</b><div class="xs muted">${esc(p.email)}${p.activo ? '' : ' · inactivo'}</div></div><button class="ibtn" type="button" data-reset="${p.id}" title="Restablecer contraseña">${ic('i-key', 16)}</button></div>`).join('') || '<p class="muted small">Sin coordinador.</p>'}</div>
      <div class="card w12"><div><span class="lbl">Simulacros del colegio</span><h2>Programados y aplicados</h2></div>${listaAplicaciones(apls, grupos, { avance: true })}</div>
    </div>${corp}`;
  main.onclick = async e => {
    const b = e.target.closest('button'); if (!b) return; const d = b.dataset;
    if ('editar' in d) asistenteColegio(c, grupos, recargar);
    if (d.rep) go('reportes/' + d.rep);
    if ('activo' in d) { if (await confirmar({ titulo: c.activo ? 'Desactivar colegio' : 'Activar colegio', texto: c.activo ? 'Todos sus usuarios pierden el acceso. La información se conserva.' : 'Sus usuarios podrán ingresar de nuevo.', si: c.activo ? 'Desactivar' : 'Activar', peligro: c.activo })) { try { await q(sb.from('colegios').update({ activo: !c.activo }).eq('id', c.id)); toast('Listo.'); recargar(); } catch (er) { toast(errorMsg(er), 'error'); } } }
    if (d.reset) { const p = coords.find(x => x.id === d.reset); if (await confirmar({ titulo: 'Restablecer contraseña', texto: `La contraseña de <b>${esc(p.nombres)}</b> volverá a ser su número de documento.`, si: 'Restablecer' })) { try { await usuarios({ accion: 'restablecer', id: p.id }); toast('Contraseña restablecida.'); } catch (er) { toast(errorMsg(er), 'error'); } } }
    if ('coord' in d) {
      const w = modal({ icon: 'i-teacher', titulo: 'Agregar coordinador', sub: esc(c.nombre), form: true, cuerpo: `${field('cn', 'Nombres', '', 'required')}${field('ca', 'Apellidos', '', 'required')}${field('ce', 'Correo', '', 'type="email" required', 'Será su usuario.')}${field('cd', 'Número de documento', '', 'inputmode="numeric" required', 'Será su contraseña inicial.')}`, pie: `<button class="btn sec" type="button" data-cerrar>Cancelar</button><button class="btn pri" type="submit">Crear</button>` });
      w.querySelector('form').onsubmit = async ev => { ev.preventDefault(); try { const r = await usuarios({ accion: 'crear', persona: { rol: 'coordinador', nombres: $('#cn').value.trim(), apellidos: $('#ca').value.trim(), email: $('#ce').value.trim(), documento: $('#cd').value.replace(/\D/g, ''), colegio_id: c.id } }); cerrarModal(); credenciales([r], 'Coordinador creado'); recargar(); } catch (er) { toast(errorMsg(er), 'error'); } };
    }
  };
}

// ---------- Preguntas ----------
const PF = { q: '', a: '', g: '', y: '', e: '', p: 0 };
async function preguntas({ main, recargar }) {
  main.innerHTML = cargando();
  const [{ count: total }, res] = await Promise.all([q(sb.from('preguntas').select('id', { count: 'exact', head: true })), rpc('resumen_admin')]);
  if (!total) {
    main.innerHTML = `${head('Banco de preguntas', 'Preguntas')}<div class="card">${vacio('i-bank', 'El banco está vacío', 'Cargue las 1.238 preguntas de los cuadernillos ICFES 2021, 2022 y 2023 con un clic. Tarda cerca de un minuto.', ADMIN ? `<div class="row" style="justify-content:center"><button class="btn hot" type="button" id="importar">${ic('i-upload')}Cargar banco inicial</button><button class="btn sec" type="button" id="impxls">${ic('i-upload')}Cargar desde Excel</button></div>` : '')}<p id="impmsg" class="small muted" style="text-align:center"></p></div>${corp}`;
    const bt = $('#importar'); if (bt) bt.onclick = () => importarBanco(bt, recargar);
    const bx = $('#impxls'); if (bx) bx.onclick = () => cargarPreguntasExcel(recargar);
    return;
  }
  const per = 15;
  const tiles = res.por_area.map(a => `<button type="button" class="acard" style="--ac-soft:${soft(a.area)};text-align:left;cursor:pointer" data-fa="${a.area}"><div class="top2">${aico(a.area, 36)}${a.revisar ? pill(a.revisar + ' por revisar', 'p-warn') : pill('al día', 'p-ok')}</div><div class="xs muted" style="font-weight:800">${AREAS[a.area]}</div><div class="row" style="gap:8px;align-items:baseline"><span class="sc" style="color:${col(a.area)};font-size:28px">${a.listas}</span><span class="xs muted">listas de 500</span></div>${barra(a.listas, col(a.area), 500)}</button>`).join('');
  main.innerHTML = `${head(`${num(total)} preguntas en total`, 'Banco de preguntas', ADMIN ? `<div class="row"><button class="btn sec" type="button" data-exportar>${ic('i-down', 16)}Exportar</button><button class="btn sec" type="button" data-excel>${ic('i-upload', 16)}Cargar desde Excel</button><button class="btn pri" type="button" data-nueva>+ Nueva pregunta</button></div>` : '')}
    <div class="grid g5">${tiles}</div>
    <div class="card"><div class="filters"><div class="sfield">${ic('i-search', 18)}<input id="fq" placeholder="Buscar por texto, ID o código ICFES" value="${esc(PF.q)}"></div>
      <select id="fa" aria-label="Área"><option value="">Todas las áreas</option>${AREAS.map((a, i) => `<option value="${i}" ${PF.a === String(i) ? 'selected' : ''}>${a}</option>`).join('')}</select>
      <select id="fg" aria-label="Grado"><option value="">Todos los grados</option>${[9, 10, 11].map(g => `<option ${PF.g === String(g) ? 'selected' : ''}>${g}</option>`).join('')}</select>
      <select id="fy" aria-label="Año"><option value="">Todos los años</option>${ANIOS.map(g => `<option ${PF.y === String(g) ? 'selected' : ''}>${g}</option>`).join('')}</select>
      <select id="fe" aria-label="Estado"><option value="">Todos los estados</option>${ESTADOS.map(e => `<option ${PF.e === e ? 'selected' : ''}>${e}</option>`).join('')}</select></div>
      <div class="row between"><span class="small" id="pcount"></span><span class="xs muted" id="ppag"></span></div>
      <div class="tw"><table class="qtable"><thead><tr><th>ID</th><th>Área</th><th>Grado · año</th><th>Pregunta</th><th style="text-align:center">Clave</th><th>Estado</th><th class="r">Acciones</th></tr></thead><tbody id="ptb"><tr><td colspan="7">${cargando()}</td></tr></tbody></table></div>
      <div class="row" style="justify-content:center;gap:6px"><button class="btn sec sm" type="button" data-pg="-1">← Anterior</button><button class="btn sec sm" type="button" data-pg="1">Siguiente →</button></div>
      <p class="xs muted">«Lista»: completa. «Por revisar»: tiene figura, tabla o símbolos que hay que comparar con el cuadernillo. «Repetida»: el ICFES la usó en otro año. «Retirada»: no se usa en simulacros nuevos.</p></div>${corp}`;
  let pags = 1;
  const cargar = async () => {
    let qq = sb.from('preguntas').select('id,area,grado,anio,codigo_icfes,competencia,enunciado,contexto,estado,figura_url', { count: 'exact' });
    if (PF.a !== '') qq = qq.eq('area', +PF.a); if (PF.g) qq = qq.eq('grado', +PF.g); if (PF.y) qq = qq.eq('anio', +PF.y); if (PF.e) qq = qq.eq('estado', PF.e);
    if (PF.q) { const t = PF.q.replace(/[,()%]/g, ' ').trim(); qq = qq.or(`enunciado.ilike.%${t}%,id.ilike.%${t}%,codigo_icfes.ilike.%${t}%,contexto.ilike.%${t}%`); }
    const { data, count } = await q(qq.order('anio', { ascending: false }).order('id').range(PF.p * per, PF.p * per + per - 1));
    pags = Math.max(1, Math.ceil(count / per));
    const ids = data.map(x => x.id);
    const claves = ADMIN && ids.length ? await q(sb.from('claves').select('*').in('pregunta_id', ids)) : [];
    const k = id => claves.find(c => c.pregunta_id === id)?.respuesta || '—';
    $('#pcount').innerHTML = `<b>${num(count)}</b> preguntas encontradas`; $('#ppag').textContent = `Página ${PF.p + 1} de ${pags}`;
    $('#ptb').innerHTML = data.length ? data.map(x => `<tr><td><button type="button" class="linkbtn" data-ver="${esc(x.id)}"><b class="num">${esc(x.id.replace('EPA', ''))}</b></button><div class="xs muted">${esc(x.codigo_icfes || '')}</div></td><td>${chip(x.area)}</td><td class="num">${x.grado ? x.grado + '.° · ' : ''}${x.anio || ''}</td><td style="min-width:240px;max-width:420px"><div class="clamp small">${esc(x.enunciado || x.contexto || '(pregunta con imagen)')}</div><div class="xs muted">${esc(x.competencia || '')}</div></td><td style="text-align:center"><span class="okbadge">${k(x.id)}</span></td><td>${estPill(x.estado)}${x.figura_url ? `<div class="xs muted">con figura</div>` : ''}</td>
      <td class="r"><div class="row" style="justify-content:flex-end;gap:4px;flex-wrap:nowrap"><button class="ibtn" type="button" data-ver="${esc(x.id)}" title="Ver">${ic('i-eye', 17)}</button>${ADMIN ? `<button class="ibtn" type="button" data-editar="${esc(x.id)}" title="Editar">${ic('i-edit', 17)}</button><button class="ibtn danger" type="button" data-borrar="${esc(x.id)}" title="Borrar o retirar">${ic('i-trash', 17)}</button>` : ''}</div></td></tr>`).join('')
      : `<tr><td colspan="7">${vacio('i-search', 'No hay preguntas con esos filtros')}</td></tr>`;
  };
  await cargar();
  let t0;
  main.oninput = e => { if (e.target.id === 'fq') { clearTimeout(t0); t0 = setTimeout(() => { PF.q = e.target.value; PF.p = 0; cargar(); }, 350); } };
  main.onchange = e => { const m = { fa: 'a', fg: 'g', fy: 'y', fe: 'e' }[e.target.id]; if (m) { PF[m] = e.target.value; PF.p = 0; cargar(); } };
  main.onclick = async e => {
    const b = e.target.closest('button'); if (!b) return; const d = b.dataset;
    if (d.pg) { PF.p = Math.max(0, Math.min(pags - 1, PF.p + +d.pg)); cargar(); }
    if (d.fa !== undefined) { PF.a = d.fa; PF.p = 0; $('#fa').value = d.fa; cargar(); }
    if (d.ver) verPregunta(d.ver, cargar);
    if (d.editar) editarPregunta(d.editar, cargar);
    if ('nueva' in d) editarPregunta(null, cargar);
    if (d.borrar) borrarPregunta(d.borrar, cargar);
    if ('exportar' in d) exportarBanco(b);
    if ('excel' in d) cargarPreguntasExcel(recargar);
  };
}
const ANIOS = Array.from({ length: new Date().getFullYear() - 2013 }, (_, i) => new Date().getFullYear() - i);

// ---------- Carga masiva de preguntas desde Excel ----------
const COLS_P = ['ID', 'Área', 'Grado', 'Año', 'Código ICFES', 'Estado', 'Competencia', 'Afirmación', 'Contexto', 'Enunciado', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'Clave', 'Justificación'];
function areaDe(v) {
  const t = normal(v);
  if (!t) return null;
  if (t.includes('lectura') || /^(lc|lec|critica)/.test(t)) return 0;
  if (/^(ma|mat)/.test(t)) return 1;
  if (/^(sc|soc|ciudad)/.test(t)) return 2;
  if (/^(cn|cien|nat|bio|fis|quim)/.test(t)) return 3;
  if (/^(in|ing|engl)/.test(t)) return 4;
  return null;
}
function plantillaPreguntas() {
  descargarExcel('Plantilla preguntas FORTALECER', {
    Preguntas: [COLS_P,
      ['', 'Matemáticas', 11, 2024, 'MAT-2024-01', 'Lista', 'Formulación y ejecución', '', 'Un bus sale cada 15 minutos de la terminal.', '¿Cuántos buses salen en 3 horas?', '10', '12', '15', '20', '', '', '', '', 'B', '3 horas son 180 minutos y 180 ÷ 15 = 12.'],
      ['', 'Inglés', 11, 2024, '', 'Por revisar', 'Parte 2', '', '', 'Where can you buy medicine?', 'pharmacy', 'library', 'stadium', '', '', '', '', '', 'A', '']],
    Instrucciones: [['Cómo llenar la plantilla'],
      ['Una fila por pregunta. No cambie los títulos de la primera fila. Borre las dos filas de ejemplo.'],
      ['ID: déjelo vacío para preguntas nuevas (el sistema lo crea). Si escribe un ID que ya existe, puede actualizar esa pregunta.'],
      ['Área (obligatoria): Lectura Crítica, Matemáticas, Sociales, Ciencias Naturales o Inglés.'],
      ['Contexto: texto, tabla o situación que comparten varias preguntas (opcional).'],
      ['Enunciado (obligatorio): la pregunta.'],
      ['A a H: las opciones. Mínimo 2. Normalmente A a D (Inglés puede usar solo A a C, o hasta H en emparejamiento).'],
      ['Clave (obligatoria): la letra de la respuesta correcta, por ejemplo B.'],
      ['Estado: Lista o Por revisar. Si lo deja vacío queda «Lista».'],
      ['Imágenes: después de cargar, abra la pregunta con el lápiz (Editar) y suba la figura.'],
      ['Consejo: el botón «Exportar» descarga el banco con estas mismas columnas; puede corregir ahí y volver a cargarlo.']]
  });
}
function cargarPreguntasExcel(recargar) {
  let filas = [];
  modal({ icon: 'i-upload', tono: 'ok', titulo: 'Cargar preguntas desde Excel', sub: 'Muchas preguntas a la vez', ancho: true,
    cuerpo: `<div class="field"><label for="pxf">Archivo de Excel</label><input id="pxf" type="file" accept=".xlsx,.xls,.csv"></div>
      <div style="display:grid;gap:6px"><span class="lbl">Columnas (la primera fila son los títulos)</span><div class="row" style="gap:6px;flex-wrap:wrap">${COLS_P.map(c => `<span class="colchip">${c}</span>`).join('')}</div>
      <p class="xs muted">Obligatorias: Área, Enunciado, al menos dos opciones y Clave. Las demás son opcionales. Es el mismo formato del botón «Exportar».</p></div>
      <button class="btn ghost sm" type="button" id="pplant" style="justify-self:start;color:var(--brand)">${ic('i-down', 15)}Descargar plantilla con ejemplos</button>
      <label class="switch"><input type="checkbox" id="pact"> Si el ID ya existe, actualizar esa pregunta (si no se marca, se omite)</label>
      <div id="pprev"></div>`,
    pie: `<button class="btn sec" type="button" data-cerrar>Cancelar</button><button class="btn pri" type="button" id="pgo" disabled>Cargar</button>` });
  $('#pplant').onclick = plantillaPreguntas;
  $('#pxf').onchange = async ev => {
    const f = ev.target.files[0]; if (!f) return;
    try {
      const raw = (await leerExcel(f)).filter(r => r.some(c => String(c).trim()));
      if (raw.length < 2) throw new Error('El archivo no tiene filas de preguntas debajo de los títulos.');
      const tit = raw[0].map(normal);
      const pos = n => tit.indexOf(normal(n));
      const falta = ['Área', 'Enunciado', 'Clave'].filter(n => pos(n) < 0);
      if (falta.length) throw new Error(`Faltan estas columnas en la primera fila: ${falta.join(', ')}. Use la plantilla.`);
      const val = (r, n) => { const i = pos(n); return i < 0 ? '' : String(r[i] ?? '').trim(); };
      const vistos = new Set(); const sello = Date.now().toString(36).toUpperCase();
      filas = raw.slice(1).map((r, i) => {
        const area = areaDe(val(r, 'Área'));
        const opciones = {}; 'ABCDEFGH'.split('').forEach(L => { const t = val(r, L); if (t) opciones[L] = t; });
        const clave = val(r, 'Clave').toUpperCase().replace(/[^A-H]/g, '').slice(0, 1);
        const est = val(r, 'Estado');
        const estado = /revis/i.test(est) ? 'Por revisar' : /retir/i.test(est) ? 'Retirada' : /repet/i.test(est) ? 'Repetida' : 'Lista';
        const grado = parseInt(val(r, 'Grado')) || null, anio = parseInt(val(r, 'Año')) || null;
        let id = val(r, 'ID').replace(/\s+/g, '-');
        const enun = val(r, 'Enunciado'), ctx = val(r, 'Contexto');
        let err = area === null ? 'Área no reconocida' : !enun && !ctx ? 'Falta el enunciado' : Object.keys(opciones).length < 2 ? 'Faltan opciones (mínimo 2)' : !clave ? 'Falta la clave' : !opciones[clave] ? `La clave ${clave} no tiene opción escrita` : grado && ![9, 10, 11].includes(grado) ? 'Grado debe ser 9, 10 u 11' : '';
        if (!id && area !== null) id = `FOR-${['LEC', 'MAT', 'SOC', 'CIE', 'ING'][area]}-${sello}-${String(i + 1).padStart(3, '0')}`;
        if (!err && vistos.has(id)) err = 'ID repetido en el archivo';
        vistos.add(id);
        return { fila: i + 2, err, clave, p: { id, area, grado, anio, codigo_icfes: val(r, 'Código ICFES') || null, estado, competencia: val(r, 'Competencia') || null, afirmacion: val(r, 'Afirmación') || null, contexto: ctx || null, enunciado: enun || null, opciones, justificacion: val(r, 'Justificación') || null } };
      });
      const buenas = filas.filter(x => !x.err);
      const ids = buenas.map(x => x.p.id); const existen = new Set();
      for (let i = 0; i < ids.length; i += 200) (await q(sb.from('preguntas').select('id').in('id', ids.slice(i, i + 200)))).forEach(x => existen.add(x.id));
      filas.forEach(x => { x.existe = existen.has(x.p.id); });
      const nuevas = buenas.filter(x => !x.existe).length, ya = buenas.length - nuevas, malas = filas.length - buenas.length;
      $('#pprev').innerHTML = `<div class="alert ${buenas.length ? 'a-ok' : 'a-warn'}">${ic(buenas.length ? 'i-sync' : 'i-warn')}<div><b>${esc(f.name)}: ${nuevas} nuevas${ya ? `, ${ya} ya existen` : ''}${malas ? `, ${malas} con error` : ''}</b>Revise la lista. Las filas con error no se cargan: corríjalas en el Excel y vuelva a subir el archivo.</div></div>
        <div class="tw" style="max-height:280px;border:1px solid var(--line)"><table><thead><tr><th>Fila</th><th>Área</th><th>Pregunta</th><th>Clave</th><th>Estado</th></tr></thead><tbody>${filas.slice(0, 300).map(x => `<tr><td class="num">${x.fila}</td><td>${x.p.area !== null ? chip(x.p.area) : '—'}</td><td style="max-width:360px"><div class="clamp small">${esc(x.p.enunciado || x.p.contexto || '')}</div></td><td class="num"><b>${esc(x.clave || '—')}</b></td><td>${x.err ? pill(esc(x.err), 'p-warn') : x.existe ? pill('Ya existe', 'p-info') : pill('Nueva', 'p-ok')}</td></tr>`).join('')}</tbody></table></div>`;
      const pintarBoton = () => { const n = nuevas + ($('#pact').checked ? ya : 0); $('#pgo').disabled = !n; $('#pgo').textContent = n ? `Cargar ${n} preguntas` : 'Cargar'; };
      $('#pact').onchange = pintarBoton; pintarBoton();
    } catch (er) { $('#pprev').innerHTML = ''; $('#pgo').disabled = true; toast('No se pudo leer el archivo: ' + errorMsg(er), 'error'); }
  };
  $('#pgo').onclick = async () => {
    const act = $('#pact').checked;
    const lista = filas.filter(x => !x.err && (act || !x.existe));
    const btn = $('#pgo'); btn.disabled = true;
    try {
      for (let i = 0; i < lista.length; i += 100) {
        const lote = lista.slice(i, i + 100);
        await q(sb.from('preguntas').upsert(lote.map(x => ({ ...x.p, actualizado_en: new Date().toISOString() })), { onConflict: 'id' }));
        await q(sb.from('claves').upsert(lote.map(x => ({ pregunta_id: x.p.id, respuesta: x.clave })), { onConflict: 'pregunta_id' }));
        btn.textContent = `Cargando… ${Math.min(i + 100, lista.length)} de ${lista.length}`;
      }
      cerrarModal(); toast(`${lista.length} preguntas cargadas.`); recargar();
    } catch (er) { btn.disabled = false; btn.textContent = 'Reintentar'; toast(errorMsg(er), 'error'); }
  };
}

async function importarBanco(bt, recargar) {
  bt.disabled = true; const msg = $('#impmsg');
  try {
    const r = await fetch('datos/banco_inicial.json'); if (!r.ok) throw new Error('No se encontró el archivo datos/banco_inicial.json');
    const B = await r.json();
    for (let i = 0; i < B.length; i += 150) {
      const lote = B.slice(i, i + 150);
      await q(sb.from('preguntas').upsert(lote.map(x => ({ id: x.id, area: x.a, grado: x.g, anio: x.y, numero: x.n, codigo_icfes: x.cod, competencia: x.comp, afirmacion: x.af, evidencia: x.ev, contexto: x.ctx, enunciado: x.en, opciones: x.op, justificacion: x.ju, estado: x.est, repite_de: x.rep || null, revisar: x.rv || null })), { onConflict: 'id', ignoreDuplicates: true }));
      const cl = lote.filter(x => x.ok).map(x => ({ pregunta_id: x.id, respuesta: x.ok }));
      if (cl.length) await q(sb.from('claves').upsert(cl, { onConflict: 'pregunta_id', ignoreDuplicates: true }));
      msg.textContent = `Cargando… ${Math.min(i + 150, B.length)} de ${B.length}`;
    }
    toast('Banco inicial cargado.'); recargar();
  } catch (e) { bt.disabled = false; msg.textContent = ''; toast(errorMsg(e), 'error'); }
}
async function exportarBanco(b) {
  b.disabled = true; toast('Preparando el Excel…');
  try {
    let todo = [], i = 0;
    while (true) { const L = await q(sb.from('preguntas').select('*').order('id').range(i, i + 999)); todo = todo.concat(L); if (L.length < 1000) break; i += 1000; }
    let cl = [], j = 0; while (true) { const L = await q(sb.from('claves').select('*').range(j, j + 999)); cl = cl.concat(L); if (L.length < 1000) break; j += 1000; }
    const k = Object.fromEntries(cl.map(c => [c.pregunta_id, c.respuesta]));
    descargarExcel('Banco de preguntas FORTALECER', { Preguntas: [COLS_P, ...todo.map(x => [x.id, AREAS[x.area], x.grado, x.anio, x.codigo_icfes, x.estado, x.competencia, x.afirmacion, x.contexto, x.enunciado, ...'ABCDEFGH'.split('').map(L => x.opciones?.[L] ?? ''), k[x.id], x.justificacion])] });
  } catch (e) { toast(errorMsg(e), 'error'); }
  b.disabled = false;
}
async function verPregunta(id, alCambiar) {
  const [x, cl] = await Promise.all([q(sb.from('preguntas').select('*').eq('id', id).single()), ADMIN ? q(sb.from('claves').select('*').eq('pregunta_id', id).maybeSingle()) : null]);
  const ok = cl?.respuesta;
  const opts = Object.entries(x.opciones || {}).map(([k, v]) => `<div class="opt ${k === ok ? 'right' : ''}" style="cursor:default"><span class="k">${k}</span><span>${esc(v)}</span>${k === ok ? `<span class="pill p-ok">${ic('i-sync', 13)} Correcta</span>` : '<span></span>'}</div>`).join('');
  const meta = [['Código ICFES', x.codigo_icfes], ['Fuente', `Evaluar para Avanzar ${x.anio || ''} · grado ${x.grado || ''} · pregunta ${x.numero || ''}`], ['Competencia', x.competencia], ['Afirmación', x.afirmacion], ['Evidencia', x.evidencia]].filter(m => m[1]).map(m => `<div><span class="lbl">${m[0]}</span><p class="small">${esc(m[1])}</p></div>`).join('');
  const w = modal({ icon: 'i-eye', titulo: `Pregunta ${esc(x.id.replace('EPA', ''))}`, sub: `${AREAS[x.area]} · ${x.estado}${x.repite_de ? ' · repite ' + esc(x.repite_de) : ''}`, ancho: true,
    cuerpo: `${x.revisar ? `<div class="alert a-warn">${ic('i-warn')}<div><b>Por revisar</b>${esc(x.revisar)}</div></div>` : ''}${x.contexto ? `<div class="ctx" style="max-height:220px">${esc(x.contexto)}</div>` : ''}${x.figura_url ? `<img src="${esc(x.figura_url)}" alt="Figura" style="max-width:100%;border-radius:12px;border:1px solid var(--line)">` : ''}<div class="stem"><p>${esc(x.enunciado || '(El enunciado es una imagen del cuadernillo.)')}</p></div><div class="opts">${opts || '<p class="small muted">Opciones gráficas: se ven en el cuadernillo.</p>'}</div>
      ${x.justificacion && ADMIN ? `<div class="card" style="box-shadow:none;background:var(--ok-soft);padding:16px"><span class="lbl" style="color:var(--ok)">Por qué ${ok || ''} es la correcta</span><p class="small">${esc(x.justificacion)}</p></div>` : ''}<div class="grid g2" style="gap:12px">${meta}</div>`,
    pie: ADMIN ? `<button class="btn ghost" type="button" id="vb" style="color:var(--bad);margin-right:auto">${ic('i-trash', 16)}Borrar</button><button class="btn sec" type="button" id="vd">${ic('i-copy', 16)}Duplicar</button><button class="btn pri" type="button" id="ve">${ic('i-edit', 16)}Editar</button>` : `<button class="btn pri" type="button" data-cerrar>Cerrar</button>` });
  if (ADMIN) {
    $('#ve').onclick = () => editarPregunta(id, alCambiar);
    $('#vb').onclick = () => borrarPregunta(id, alCambiar);
    $('#vd').onclick = async () => { try { const nid = x.id + '-COPIA' + Date.now().toString().slice(-4); const c = { ...x, id: nid, estado: 'Por revisar', repite_de: null, actualizado_en: new Date().toISOString() }; await q(sb.from('preguntas').insert(c)); if (ok) await q(sb.from('claves').insert({ pregunta_id: nid, respuesta: ok })); toast('Copia creada. Ajústela y guarde.'); editarPregunta(nid, alCambiar); } catch (e) { toast(errorMsg(e), 'error'); } };
  }
}
async function editarPregunta(id, alCambiar) {
  const x = id ? await q(sb.from('preguntas').select('*').eq('id', id).single()) : { area: 0, grado: 11, estado: 'Por revisar', opciones: {}, competencia: '', contexto: '', enunciado: '', justificacion: '', afirmacion: '' };
  const ok = id ? (await q(sb.from('claves').select('*').eq('pregunta_id', id).maybeSingle()))?.respuesta : 'A';
  let figura = x.figura_url || null, archivo = null;
  const ta = (k, l, v, r) => `<div class="field"><label for="qf-${k}">${l}</label><textarea id="qf-${k}" rows="${r}">${esc(v || '')}</textarea></div>`;
  const w = modal({ icon: 'i-edit', titulo: id ? `Editar ${esc(id.replace('EPA', ''))}` : 'Nueva pregunta', sub: 'Los cambios quedan registrados con fecha', form: true, ancho: true,
    cuerpo: `<div class="grid" style="gap:12px;align-items:start;grid-template-columns:repeat(auto-fit,minmax(170px,1fr))">${selectField('qf-a', 'Área', AREAS.map((a, i) => [i, a]), x.area)}${selectField('qf-g', 'Grado', [9, 10, 11], x.grado || 11)}${selectField('qf-e', 'Estado', ESTADOS, x.estado)}${field('qf-comp', 'Competencia', x.competencia || '')}</div>
      ${ta('ctx', 'Texto o contexto compartido (opcional)', x.contexto, 3)}${ta('en', 'Enunciado', x.enunciado, 3)}
      <div class="field"><label>Figura, tabla o dibujo (opcional)</label><div class="row">${figura ? `<img id="qf-prev" src="${esc(figura)}" alt="" style="max-height:90px;border-radius:10px;border:1px solid var(--line)">` : '<span class="xs muted" id="qf-prev">Sin figura</span>'}<label class="btn sec sm" for="qf-file">${ic('i-upload', 15)}Subir imagen</label><input id="qf-file" type="file" accept="image/*" hidden>${figura ? '<button class="btn ghost sm" type="button" id="qf-rm">Quitar</button>' : ''}</div></div>
      <div class="grid" style="gap:10px">${['A', 'B', 'C', 'D'].map(k => `<div class="optedit"><label class="radio"><input type="radio" name="qf-ok" value="${k}" ${ok === k ? 'checked' : ''}><span>${k}</span></label><input id="qf-o${k}" aria-label="Opción ${k}" value="${esc(x.opciones?.[k] || '')}" placeholder="Texto de la opción ${k}"></div>`).join('')}<span class="hint">Marque el cuadro de la opción correcta.</span></div>
      ${ta('ju', 'Justificación de la respuesta correcta', x.justificacion, 3)}${ta('af', 'Afirmación (ICFES)', x.afirmacion, 2)}`,
    pie: `<button class="btn sec" type="button" data-cerrar>Cancelar</button><button class="btn pri" type="submit" id="qf-go">${id ? 'Guardar cambios' : 'Crear pregunta'}</button>` });
  $('#qf-file').onchange = e => { archivo = e.target.files[0]; if (archivo) { const u = URL.createObjectURL(archivo); $('#qf-prev').outerHTML = `<img id="qf-prev" src="${u}" alt="" style="max-height:90px;border-radius:10px">`; } };
  const rm = $('#qf-rm'); if (rm) rm.onclick = () => { figura = null; archivo = null; $('#qf-prev').outerHTML = '<span class="xs muted" id="qf-prev">Sin figura</span>'; };
  w.querySelector('form').onsubmit = async e => {
    e.preventDefault(); const btn = $('#qf-go'); btn.disabled = true;
    try {
      const nid = id || `NUEVA-${Date.now().toString(36).toUpperCase()}`;
      if (archivo) figura = await subirArchivo('figuras', archivo, nid.toLowerCase());
      const op = {}; ['A', 'B', 'C', 'D'].forEach(k => { const v = $('#qf-o' + k).value.trim(); if (v) op[k] = v; });
      const r = document.querySelector('input[name="qf-ok"]:checked')?.value;
      const datos = { id: nid, area: +$('#qf-a').value, grado: +$('#qf-g').value, estado: $('#qf-e').value, competencia: $('#qf-comp').value.trim(), contexto: $('#qf-ctx').value.trim(), enunciado: $('#qf-en').value.trim(), justificacion: $('#qf-ju').value.trim(), afirmacion: $('#qf-af').value.trim(), opciones: op, figura_url: figura, actualizado_en: new Date().toISOString() };
      if (!id) datos.anio = new Date().getFullYear();
      if (datos.estado === 'Lista' && (!r || (!datos.enunciado && !figura))) throw new Error('Para marcarla como «Lista» necesita enunciado (o figura) y respuesta correcta.');
      await q(sb.from('preguntas').upsert(datos));
      if (r) await q(sb.from('claves').upsert({ pregunta_id: nid, respuesta: r }));
      cerrarModal(); toast(id ? 'Cambios guardados.' : 'Pregunta creada.'); alCambiar(); verPregunta(nid, alCambiar);
    } catch (er) { btn.disabled = false; toast(errorMsg(er), 'error'); }
  };
}
function borrarPregunta(id, alCambiar) {
  const w = modal({ icon: 'i-trash', tono: 'coral', titulo: '¿Borrar esta pregunta?', sub: esc(id),
    cuerpo: `<div class="grid g2" style="gap:12px"><div class="card" style="box-shadow:none;background:var(--surface-2);padding:16px"><b>Retirar (recomendado)</b><p class="small muted">Deja de usarse en simulacros nuevos, pero se conserva para los reportes de simulacros ya presentados.</p></div><div class="card" style="box-shadow:none;background:var(--bad-soft);padding:16px"><b style="color:var(--bad)">Borrar definitivamente</b><p class="small muted">Solo si nunca se usó en un simulacro. No se puede deshacer.</p></div></div>`,
    pie: `<button class="btn sec" type="button" data-cerrar>Cancelar</button><button class="btn sec" type="button" id="bret">Retirar</button><button class="btn hot" type="button" id="bdel" style="background:var(--bad);font-size:14px;padding:12px 18px">Borrar definitivamente</button>` });
  $('#bret').onclick = async () => { try { await q(sb.from('preguntas').update({ estado: 'Retirada' }).eq('id', id)); cerrarModal(); toast('Pregunta retirada.'); alCambiar(); } catch (e) { toast(errorMsg(e), 'error'); } };
  $('#bdel').onclick = async () => { try { await q(sb.from('preguntas').delete().eq('id', id)); cerrarModal(); toast('Pregunta borrada.'); alCambiar(); } catch (e) { toast(/foreign key|violates/i.test(e.message) ? 'Esta pregunta ya está en un simulacro. Retírela en lugar de borrarla.' : errorMsg(e), 'error'); } };
}

// ---------- Simulacros ----------
async function simulacros({ main, recargar }) {
  main.innerHTML = cargando();
  const sims = await rpc('estado_simulacros');
  const completos = sims.filter(s => s.por_area.every(n => n === 25)).length;
  main.innerHTML = `${head('Los mismos para todos los grados', 'Simulacros', ADMIN ? `<button class="btn pri" type="button" data-armar>${ic('i-sync', 16)}Armar automáticamente</button>` : '')}
    <div class="alert a-info">${ic('i-info')}<div><b>${completos} de ${sims.length} simulacros completos</b>«Armar automáticamente» llena los simulacros sin publicar con preguntas «Lista» que no se hayan usado, 25 por área. Publique un simulacro para que los colegios lo puedan programar.</div></div>
    <div class="grid g4">${sims.map(s => { const tot = s.por_area.reduce((a, b) => a + b, 0), full = tot === 125;
      return `<div class="card lift simcard"><div class="row between"><span class="simno">${String(s.id).padStart(2, '0')}</span>${s.publicado ? pill('Publicado', 'p-ok') : full ? pill('Listo', 'p-brand') : pill(tot ? 'Incompleto' : 'Vacío', 'p-warn')}</div>
        <div style="display:grid;gap:6px">${s.por_area.map((n, i) => `<div class="minibar"><span style="color:${col(i)}">${ic(['a-book', 'a-sigma', 'a-globe', 'a-flask', 'a-chat'][i], 13)}</span>${barra(n, col(i), 25)}<span class="xs num">${n}</span></div>`).join('')}</div>
        <span class="xs muted"><b>${tot}</b> de 125${s.aplicado ? ' · ya programado' : ''}</span>
        <div class="row" style="gap:6px">${tot ? `<button class="btn sec sm" type="button" data-clave="${s.id}">${ic('i-key', 14)}Hoja de respuestas</button>` : ''}${ADMIN && full && !s.publicado ? `<button class="btn pri sm" type="button" data-pub="${s.id}">Publicar</button>` : ''}${ADMIN && s.publicado && !s.aplicado ? `<button class="btn ghost sm" type="button" data-despub="${s.id}">Despublicar</button>` : ''}${ADMIN && tot && !s.aplicado && !s.publicado ? `<button class="btn ghost sm" type="button" data-vaciar="${s.id}">Vaciar</button>` : ''}</div></div>`; }).join('')}</div>${corp}`;
  main.onclick = async e => {
    const b = e.target.closest('button'); if (!b) return; const d = b.dataset;
    try {
      if ('armar' in d) { b.disabled = true; b.textContent = 'Armando…'; await rpc('armar_simulacros'); toast('Simulacros armados.'); recargar(); }
      if (d.pub) { await q(sb.from('simulacros').update({ publicado: true }).eq('id', +d.pub)); toast('Simulacro publicado: los colegios ya lo pueden programar.'); recargar(); }
      if (d.despub) { await q(sb.from('simulacros').update({ publicado: false }).eq('id', +d.despub)); toast('Simulacro despublicado.'); recargar(); }
      if (d.vaciar && await confirmar({ titulo: 'Vaciar simulacro', texto: 'Se quitan sus preguntas; vuelven a quedar disponibles para armar otros.', si: 'Vaciar' })) { await rpc('vaciar_simulacro', { p_simulacro: +d.vaciar }); recargar(); }
      if (d.clave) hojaRespuestas(+d.clave);
    } catch (er) { toast(errorMsg(er), 'error'); recargar(); }
  };
}
async function hojaRespuestas(id) {
  const sp = await q(sb.from('simulacro_preguntas').select('posicion,pregunta_id').eq('simulacro_id', id).order('posicion'));
  const cl = ADMIN ? await q(sb.from('claves').select('*').in('pregunta_id', sp.map(x => x.pregunta_id))) : [];
  const k = Object.fromEntries(cl.map(c => [c.pregunta_id, c.respuesta]));
  const w = modal({ icon: 'i-key', titulo: `Hoja de respuestas · Simulacro ${id}`, sub: 'Solo la ve la administración. Toque un número para ver la pregunta.', ancho: true,
    cuerpo: `<div style="display:grid;gap:18px">${AREAS.map((a, i) => `<div style="display:grid;gap:8px"><div class="row" style="gap:8px">${aico(i, 28)}<b class="small">${a}</b><span class="xs muted">preguntas ${i * 25 + 1} a ${i * 25 + 25}</span></div><div class="keygrid">${Array.from({ length: 25 }, (_, j) => { const pos = i * 25 + j + 1, x = sp.find(z => z.posicion === pos); return x ? `<button type="button" class="keycell" data-verq="${esc(x.pregunta_id)}" title="${esc(x.pregunta_id)}"><span class="xs muted">${pos}</span><b>${k[x.pregunta_id] || '?'}</b></button>` : `<span class="keycell empty"><span class="xs muted">${pos}</span><b>—</b></span>`; }).join('')}</div></div>`).join('')}</div>`,
    pie: `<button class="btn sec" type="button" id="dlk">${ic('i-down', 15)}Descargar en Excel</button><button class="btn pri" type="button" data-cerrar>Cerrar</button>` });
  w.onclick = e => { const b = e.target.closest('[data-verq]'); if (b) verPregunta(b.dataset.verq, () => { }); };
  $('#dlk').onclick = () => descargarExcel(`Hoja de respuestas Simulacro ${id}`, { Claves: [['Posición', 'Área', 'Pregunta', 'Clave'], ...sp.map(x => [x.posicion, AREAS[Math.floor((x.posicion - 1) / 25)], x.pregunta_id, k[x.pregunta_id]])] });
}

// ---------- Reportes globales ----------
async function reportes({ main, params, go }) {
  if (params[0]) return reporteAplicacion(main, params[0], { rol: 'admin', volver: `<div class="row"><button class="btn ghost sm" type="button" data-ir="reportes">← Reportes globales</button></div>` });
  main.innerHTML = cargando();
  const [rg, apls, grupos, cols] = await Promise.all([rpc('reporte_global'), q(sb.from('aplicaciones').select('*').order('inicio', { ascending: false }).limit(200)), q(sb.from('grupos').select('*')), q(sb.from('colegios').select('id,nombre'))]);
  const con = rg.filter(r => r.presentaron);
  main.innerHTML = `${head('Todos los colegios', 'Reportes globales', con.length ? `<button class="btn sec" type="button" data-dl>${ic('i-down', 16)}Excel</button>` : '')}
    ${con.length ? `<div class="bento"><div class="card w7"><div class="row between"><div><span class="lbl">Mapa de calor</span><h2>Colegios por área</h2></div>${lvLegend}</div>${heat(con.map(r => r.nombre), SHORT, (i, j) => con[i].areas?.[j] ?? null)}</div>
      <div class="card w5"><div><span class="lbl">Puntaje global promedio</span><h2>Ranking de colegios</h2></div><div class="tw"><table><thead><tr><th></th><th>Colegio</th><th class="r">Pres.</th><th class="r">Global</th></tr></thead><tbody>${[...con].sort((a, b) => b.global - a.global).map((r, i) => `<tr><td class="num"><b>${i + 1}</b></td><td><div class="row" style="gap:8px;flex-wrap:nowrap">${escudo(r.escudo_url, r.nombre, 28)}<span class="small">${esc(r.nombre)}</span></div></td><td class="r num">${r.presentaron}</td><td class="r num"><b>${r.global}</b></td></tr>`).join('')}</tbody></table></div></div></div>`
      : `<div class="card">${vacio('i-results', 'Todavía no hay resultados', 'Cuando los colegios apliquen simulacros, aquí verá la comparación.')}</div>`}
    <div class="card"><div><span class="lbl">Por colegio y grupo</span><h2>Simulacros aplicados</h2></div>${apls.length ? listaAplicaciones(apls.map(a => ({ ...a })), grupos.map(g => ({ ...g, nombre: g.nombre + ' · ' + (cols.find(c => c.id === g.colegio_id)?.nombre || '') })), { avance: true }) : vacio('i-cal', 'Sin simulacros programados')}</div>${corp}`;
  main.onclick = e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.rep) go('reportes/' + b.dataset.rep); if ('dl' in b.dataset) descargarExcel('Reporte global FORTALECER', { Colegios: [['Colegio', 'Presentaron', ...AREAS, 'Global'], ...con.map(r => [r.nombre, r.presentaron, ...(r.areas || []), r.global])] }); };
}

// ---------- Usuarios ----------
async function usuariosPantalla({ S, main, recargar }) {
  main.innerHTML = cargando();
  const [perf, cols] = await Promise.all([q(sb.from('perfiles').select('*').order('apellidos').limit(5000)), q(sb.from('colegios').select('id,nombre'))]);
  const cn = id => cols.find(c => c.id === id)?.nombre || '—';
  let tab = main.dataset.tab || 'coordinador', buscar = '';
  const TABS = [['coordinador', 'Coordinadores'], ['docente', 'Docentes'], ['estudiante', 'Estudiantes'], ['soporte', 'Soporte'], ['admin', 'Administradores']];
  const pintar = () => {
    const L = perf.filter(p => p.rol === tab && (!buscar || normal(`${p.nombres} ${p.apellidos} ${p.documento} ${p.email}`).includes(normal(buscar)))).slice(0, 300);
    $('#utb').innerHTML = L.length ? L.map(p => `<tr><td><div class="row" style="gap:10px;flex-wrap:nowrap"><span class="av" style="width:32px;height:32px;font-size:11px;border-radius:10px">${esc(iniciales(p.nombres + ' ' + p.apellidos))}</span><b class="small">${esc(p.nombres)} ${esc(p.apellidos)}</b></div></td><td class="small">${esc(tab === 'estudiante' ? p.documento : p.email)}</td><td class="small">${esc(cn(p.colegio_id))}</td><td>${p.activo ? (p.debe_cambiar_clave ? pill('No ha ingresado', 'p-warn') : pill('Activo', 'p-ok')) : pill('Inactivo')}</td>
      <td class="r">${p.id !== S.perfil.id && p.rol !== 'admin' ? `<div class="row" style="justify-content:flex-end;gap:4px;flex-wrap:nowrap"><button class="ibtn" type="button" data-reset="${p.id}" title="Restablecer contraseña">${ic('i-key', 16)}</button>${ADMIN ? `<button class="ibtn ${p.activo ? 'danger' : ''}" type="button" data-activo="${p.id}" title="${p.activo ? 'Desactivar' : 'Activar'}">${ic(p.activo ? 'i-exit' : 'i-sync', 16)}</button>` : ''}</div>` : ''}</td></tr>`).join('') : `<tr><td colspan="5">${vacio('i-users', 'Sin usuarios en esta lista')}</td></tr>`;
    $$('[data-tab]', main).forEach(b => b.setAttribute('aria-pressed', b.dataset.tab === tab));
  };
  main.innerHTML = `${head('Todos los colegios', 'Usuarios', ADMIN ? `<button class="btn pri" type="button" data-soporte>+ Persona de soporte</button>` : '')}
    <div class="grid g4">${kpi('i-teacher', 'var(--brand)', 'var(--brand-soft)', perf.filter(p => p.rol === 'coordinador').length, 'coordinadores')}${kpi('i-users', 'var(--a1)', 'var(--a1s)', perf.filter(p => p.rol === 'docente').length, 'docentes')}${kpi('i-user', 'var(--a3)', 'var(--a3s)', perf.filter(p => p.rol === 'estudiante').length, 'estudiantes')}${kpi('i-support', 'var(--a4)', 'var(--a4s)', perf.filter(p => p.rol === 'soporte').length, 'soporte')}</div>
    <div class="card"><div class="row between"><div class="tabs" role="group">${TABS.map(t => `<button type="button" data-tab="${t[0]}">${t[1]}</button>`).join('')}</div><div class="sfield" style="max-width:320px">${ic('i-search', 18)}<input id="ub" placeholder="Buscar por nombre, correo o documento"></div></div>
      <div class="tw"><table><thead><tr><th>Nombre</th><th>Usuario</th><th>Colegio</th><th>Estado</th><th class="r">Acciones</th></tr></thead><tbody id="utb"></tbody></table></div>
      <p class="xs muted">Los coordinadores se crean desde la ficha de cada colegio. Los docentes y estudiantes los registra la coordinación de cada colegio.</p></div>${corp}`;
  pintar();
  main.oninput = e => { if (e.target.id === 'ub') { buscar = e.target.value; pintar(); } };
  main.onclick = async e => {
    const b = e.target.closest('button'); if (!b) return; const d = b.dataset;
    if (d.tab) { tab = d.tab; main.dataset.tab = tab; pintar(); }
    if (d.reset) { const p = perf.find(x => x.id === d.reset); if (await confirmar({ titulo: 'Restablecer contraseña', texto: `La contraseña de <b>${esc(p.nombres)} ${esc(p.apellidos)}</b> volverá a ser su número de documento.`, si: 'Restablecer' })) { try { await usuarios({ accion: 'restablecer', id: p.id }); toast('Contraseña restablecida.'); } catch (er) { toast(errorMsg(er), 'error'); } } }
    if (d.activo) { const p = perf.find(x => x.id === d.activo); if (await confirmar({ titulo: p.activo ? 'Desactivar usuario' : 'Activar usuario', texto: p.activo ? 'No podrá ingresar. Su información se conserva.' : 'Podrá ingresar de nuevo.', si: p.activo ? 'Desactivar' : 'Activar', peligro: p.activo })) { try { await usuarios({ accion: p.activo ? 'desactivar' : 'activar', id: p.id }); recargar(); } catch (er) { toast(errorMsg(er), 'error'); } } }
    if ('soporte' in d) {
      const w = modal({ icon: 'i-support', titulo: 'Agregar persona de soporte', sub: 'Puede consultar colegios, reportes y usuarios, y restablecer contraseñas. No edita.', form: true, cuerpo: `${field('sn', 'Nombres', '', 'required')}${field('sa', 'Apellidos', '', 'required')}${field('se', 'Correo', '', 'type="email" required')}${field('sd', 'Número de documento', '', 'inputmode="numeric" required', 'Será su contraseña inicial.')}`, pie: `<button class="btn sec" type="button" data-cerrar>Cancelar</button><button class="btn pri" type="submit">Crear</button>` });
      w.querySelector('form').onsubmit = async ev => { ev.preventDefault(); try { const r = await usuarios({ accion: 'crear', persona: { rol: 'soporte', nombres: $('#sn').value.trim(), apellidos: $('#sa').value.trim(), email: $('#se').value.trim(), documento: $('#sd').value.replace(/\D/g, '') } }); cerrarModal(); credenciales([r], 'Soporte creado'); recargar(); } catch (er) { toast(errorMsg(er), 'error'); } };
    }
  };
}
