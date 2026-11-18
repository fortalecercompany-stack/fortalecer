// FORTALECER · editar y borrar personas (lo usan el administrador y la coordinación)
import { $, esc, ic, AREAS, toast, errorMsg, modal, cerrarModal, field, selectField } from './lib.js';
import { sb, q, usuarios } from './api.js';

const ROLES = [['coordinador', 'Coordinador(a)'], ['docente', 'Docente'], ['estudiante', 'Estudiante'], ['soporte', 'Soporte']];
const gtxt = g => `${g.grado}.° ${g.nombre}`;

// Ventana para cambiar los datos de una persona.
// esAdmin: deja cambiar el cargo y el colegio. colegios: lista {id,nombre} para elegir.
export async function editarPersona(p, { esAdmin = false, colegios = [], alCambiar } = {}) {
  let grupos = p.colegio_id ? await q(sb.from('grupos').select('id,grado,nombre').eq('colegio_id', p.colegio_id).order('grado')) : [];
  const w = modal({ icon: 'i-edit', titulo: `Editar a ${esc(p.nombres)}`, sub: esAdmin ? 'Puede cambiar sus datos, su cargo y su colegio' : 'Cambie los datos que necesite', form: true, ancho: true,
    cuerpo: `<div class="grid" style="gap:12px;align-items:start;grid-template-columns:repeat(auto-fit,minmax(210px,1fr))">
      ${field('pn', 'Nombres', p.nombres, 'required')}${field('pa', 'Apellidos', p.apellidos, '')}
      ${field('pd', 'Número de documento', p.documento || '', 'inputmode="numeric" required', p.rol === 'estudiante' ? 'Es su usuario para entrar.' : 'Si se restablece la contraseña, vuelve a ser este número.')}
      <div class="field" id="boxmail" ${p.rol === 'estudiante' ? 'hidden' : ''}><label for="pe">Correo</label><input id="pe" type="email" value="${esc(p.email || '')}"><span class="hint">Es su usuario para entrar.</span></div>
      ${esAdmin && p.rol !== 'admin' ? selectField('pr', 'Cargo', ROLES, p.rol) : ''}
      ${esAdmin && p.rol !== 'admin' ? `<div class="field" id="boxcol"><label for="pc">Colegio</label><select id="pc"><option value="">Ninguno</option>${colegios.map(c => `<option value="${c.id}" ${c.id === p.colegio_id ? 'selected' : ''}>${esc(c.nombre)}</option>`).join('')}</select></div>` : ''}
      <div class="field" id="boxgr" ${p.rol === 'estudiante' ? '' : 'hidden'}><label for="pg">Grupo</label><select id="pg"></select></div>
      <div class="field" id="boxar" ${p.rol === 'docente' ? '' : 'hidden'}><label for="par">Área ICFES</label><select id="par"><option value="">Ninguna</option>${AREAS.map((a, i) => `<option value="${i}" ${p.area === i ? 'selected' : ''}>${a}</option>`).join('')}</select></div>
    </div>
    <div class="alert a-info">${ic('i-info')}<div><b>Su contraseña no cambia</b>Si cambia el correo o el documento, la persona entra con el dato nuevo y la misma contraseña.</div></div>`,
    pie: `<button class="btn sec" type="button" data-cerrar>Cancelar</button><button class="btn pri" type="submit">Guardar cambios</button>` });
  const rol = () => $('#pr')?.value || p.rol;
  const pintarGrupos = sel => { $('#pg').innerHTML = `<option value="">Sin grupo</option>${grupos.map(g => `<option value="${g.id}" ${g.id === sel ? 'selected' : ''}>${esc(gtxt(g))}</option>`).join('')}`; };
  pintarGrupos(p.grupo_id);
  const ajustar = () => { const r = rol(); $('#boxmail').hidden = r === 'estudiante'; $('#boxgr').hidden = r !== 'estudiante'; $('#boxar').hidden = r !== 'docente'; if ($('#boxcol')) $('#boxcol').hidden = r === 'soporte'; };
  $('#pr')?.addEventListener('change', ajustar);
  $('#pc')?.addEventListener('change', async e => { grupos = e.target.value ? await q(sb.from('grupos').select('id,grado,nombre').eq('colegio_id', e.target.value).order('grado')) : []; pintarGrupos(''); });
  w.querySelector('form').onsubmit = async ev => {
    ev.preventDefault();
    const r = rol();
    const cambios = { nombres: $('#pn').value.trim(), apellidos: $('#pa').value.trim(), documento: $('#pd').value.replace(/\D/g, ''), email: $('#pe').value.trim() };
    if (esAdmin && p.rol !== 'admin') { cambios.rol = r; cambios.colegio_id = r === 'soporte' ? '' : $('#pc').value; }
    if (r === 'estudiante') cambios.grupo_id = $('#pg').value;
    if (r === 'docente') cambios.area = $('#par').value;
    if (!cambios.nombres) return toast('Escriba los nombres.', 'error');
    if (cambios.documento.length < 5) return toast('Revise el número de documento.', 'error');
    if (r !== 'estudiante' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cambios.email)) return toast('Escriba un correo válido.', 'error');
    if (esAdmin && ['coordinador', 'docente', 'estudiante'].includes(r) && !cambios.colegio_id) return toast('Elija el colegio.', 'error');
    try { await usuarios({ accion: 'editar', id: p.id, cambios }); cerrarModal(); toast('Cambios guardados.'); alCambiar?.(); }
    catch (er) { toast(errorMsg(er), 'error'); }
  };
}

// Borrar una cuenta para siempre, con confirmación escrita
export function borrarPersona(p, alCambiar) {
  const nombre = `${p.nombres} ${p.apellidos}`.trim();
  const w = modal({ icon: 'i-trash', tono: 'bad', titulo: `¿Borrar a ${esc(nombre)}?`, form: true,
    cuerpo: `<div class="alert a-warn">${ic('i-warn')}<div><b>Esto no se puede deshacer</b>Se borra su cuenta y todo lo suyo: ${p.rol === 'estudiante' ? 'sus notas, exámenes presentados y resultados de simulacros' : p.rol === 'docente' ? 'los exámenes que creó, sus notas y su banco de preguntas' : 'su acceso al sistema'}. Si solo quiere que no entre, use <b>Desactivar</b>.</div></div>
      ${field('bconf', 'Para confirmar, escriba BORRAR', '', 'autocomplete="off"')}`,
    pie: `<button class="btn sec" type="button" data-cerrar>Cancelar</button><button class="btn pri" type="submit" style="background:var(--bad)">Borrar para siempre</button>` });
  w.querySelector('form').onsubmit = async ev => {
    ev.preventDefault();
    if ($('#bconf').value.trim().toUpperCase() !== 'BORRAR') return toast('Escriba BORRAR para confirmar.', 'error');
    try { const r = await usuarios({ accion: 'borrar', id: p.id }); cerrarModal(); toast(r.hechos?.length ? `Se borró a ${nombre}.` : 'No se pudo borrar a esta persona.', r.hechos?.length ? 'ok' : 'error'); alCambiar?.(); }
    catch (er) { toast(errorMsg(er), 'error'); }
  };
}
