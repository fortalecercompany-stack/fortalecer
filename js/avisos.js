// FORTALECER · avisos (administrador → colegios, coordinador → docentes y estudiantes)
import { $, esc, ic, toast, errorMsg, modal, cerrarModal, confirmar, field, selectField, fechaHora } from './lib.js';
import { sb, q } from './api.js';

const PARA = { todos: 'Todos', coordinador: 'Coordinadores', docente: 'Docentes', estudiante: 'Estudiantes' };

// Lista de avisos vigentes para quien está conectado (tarjetas listas para pintar)
export async function avisosHTML({ S, gestionar = false, limite = 5 } = {}) {
  let lista = [];
  try { lista = await q(sb.from('avisos').select('*').order('creado_en', { ascending: false }).limit(gestionar ? 40 : limite)); }
  catch { return ''; } // si la tabla aún no existe, no se muestra nada
  const vivos = gestionar ? lista : lista.filter(a => !a.vence_en || new Date(a.vence_en) > new Date());
  if (!vivos.length && !gestionar) return '';
  const puedeBorrar = a => gestionar && (a.autor_id === S?.perfil?.id || S?.perfil?.rol === 'admin');
  return `<div class="card w12 avisos"><div class="row between"><div><span class="lbl">${ic('i-bell', 14)} Avisos</span><h2>${gestionar ? 'Avisos publicados' : 'Novedades'}</h2></div>${gestionar ? `<button class="btn pri sm" type="button" data-aviso-nuevo>${ic('i-bell', 15)}Publicar aviso</button>` : ''}</div>
    ${vivos.length ? `<div class="avlist">${vivos.map(a => `<article class="aviso"><div class="row between" style="align-items:flex-start;flex-wrap:nowrap;gap:10px"><div style="min-width:0"><b>${esc(a.titulo)}</b><p class="small" style="white-space:pre-line">${esc(a.texto)}</p>
      <span class="xs muted">${esc(a.autor || '')} · ${fechaHora(a.creado_en)}${gestionar ? ` · para ${PARA[a.para]}${a.colegio_id ? '' : ' · todos los colegios'}${a.vence_en ? ` · hasta ${fechaHora(a.vence_en)}` : ''}` : ''}</span></div>
      ${puedeBorrar(a) ? `<button class="ibtn danger" type="button" data-aviso-borrar="${a.id}" title="Borrar aviso">${ic('i-trash', 16)}</button>` : ''}</div></article>`).join('')}</div>`
    : `<p class="small muted">No hay avisos publicados. Úselos para recordar fechas de simulacros, horarios o instrucciones.</p>`}</div>`;
}

// Conecta los botones de publicar y borrar dentro de un contenedor
export function conectarAvisos(cont, { S, colegios = [], alCambiar }) {
  const card = cont?.querySelector('.avisos'); if (!card) return;
  card.onclick = async e => {
    const b = e.target.closest('button'); if (!b) return;
    if ('avisoNuevo' in b.dataset) nuevoAviso({ S, colegios, alCambiar });
    if (b.dataset.avisoBorrar) {
      if (!(await confirmar({ titulo: 'Borrar aviso', texto: 'El aviso dejará de verse para todos.', si: 'Borrar', peligro: true }))) return;
      try { await q(sb.from('avisos').delete().eq('id', b.dataset.avisoBorrar)); toast('Aviso borrado.'); alCambiar?.(); } catch (er) { toast(errorMsg(er), 'error'); }
    }
  };
}

function nuevoAviso({ S, colegios, alCambiar }) {
  const admin = S.perfil.rol === 'admin';
  const paraOpc = admin ? [['todos', 'Todos'], ['coordinador', 'Solo coordinadores'], ['docente', 'Solo docentes'], ['estudiante', 'Solo estudiantes']] : [['todos', 'Docentes y estudiantes'], ['docente', 'Solo docentes'], ['estudiante', 'Solo estudiantes']];
  const w = modal({ icon: 'i-bell', titulo: 'Publicar aviso', sub: admin ? 'Lo verán en su pantalla de inicio' : 'Lo verán en su pantalla de inicio al entrar', form: true, ancho: true,
    cuerpo: `${field('avt', 'Título', '', 'maxlength="120" required placeholder="Ej.: Simulacro 3 el lunes a las 7:00 a. m."')}
      <div class="field"><label for="avx">Mensaje</label><textarea id="avx" rows="4" maxlength="2000" required placeholder="Escriba aquí el aviso"></textarea></div>
      <div class="grid g2" style="gap:12px">${admin ? selectField('avc', 'Colegio', [['', 'Todos los colegios'], ...colegios.map(c => [c.id, c.nombre])], '') : ''}${selectField('avp', '¿Quién lo ve?', paraOpc, 'todos')}
      ${selectField('avv', 'Mostrar durante', [['', 'Hasta que lo borre'], ['1', '1 día'], ['7', '1 semana'], ['30', '1 mes']], '7')}</div>`,
    pie: `<button class="btn sec" type="button" data-cerrar>Cancelar</button><button class="btn pri" type="submit">Publicar</button>` });
  w.querySelector('form').onsubmit = async ev => {
    ev.preventDefault();
    const titulo = $('#avt').value.trim(), texto = $('#avx').value.trim();
    if (titulo.length < 3 || texto.length < 3) return toast('Escriba el título y el mensaje.', 'error');
    const dias = +$('#avv').value;
    const fila = { titulo, texto, para: $('#avp').value, colegio_id: admin ? ($('#avc').value || null) : S.perfil.colegio_id, vence_en: dias ? new Date(Date.now() + dias * 864e5).toISOString() : null };
    try { await q(sb.from('avisos').insert(fila)); cerrarModal(); toast('Aviso publicado.'); alCambiar?.(); } catch (er) { toast(errorMsg(er), 'error'); }
  };
}
