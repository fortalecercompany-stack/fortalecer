// FORTALECER · pantallas del docente
import { $, esc, ic, AREAS, chip, head, cargando, corp, iniciales, vacio, errorMsg } from './lib.js';
import { sb, q } from './api.js';
import { reporteAplicacion, listaAplicaciones, evolucionHTML } from './reportes.js';
import { avisosHTML } from './avisos.js';
import { rpc } from './api.js';

export async function render({ S, main, seccion, params, go }) {
  if (seccion === 'perfil') {
    const p = S.perfil;
    main.innerHTML = `${head('Mi cuenta', 'Perfil')}<div class="card" style="max-width:560px"><div class="row" style="gap:16px"><span class="av" style="width:64px;height:64px;font-size:20px;border-radius:18px">${esc(iniciales(p.nombres + ' ' + p.apellidos))}</span><div><b style="font-size:19px">${esc(p.nombres)} ${esc(p.apellidos)}</b><br><span class="muted small">${esc(p.email)}</span><br>${p.area != null ? chip(p.area) : ''} ${p.componente ? `<span class="xs muted">${esc(p.componente)}</span>` : ''}</div></div>
      <div class="row"><button class="btn sec" type="button" data-cambiar-clave>${ic('i-key')}Cambiar contraseña</button><button class="btn ghost" type="button" data-salir>${ic('i-exit')}Cerrar sesión</button></div></div>${corp}`;
    return;
  }
  const area = S.perfil.area;
  if (params[0]) return reporteAplicacion(main, params[0], { rol: 'docente', areaDocente: area, volver: `<div class="row"><button class="btn ghost sm" type="button" data-ir="reportes">← Mis reportes</button></div>` });
  main.innerHTML = cargando();
  const mis = await q(sb.from('docente_grupos').select('grupo_id').eq('docente_id', S.perfil.id));
  const ids = mis.map(x => x.grupo_id);
  const avHTML = await avisosHTML({ S });
  const [grupos, apls] = ids.length ? await Promise.all([q(sb.from('grupos').select('*').in('id', ids)), q(sb.from('aplicaciones').select('*').in('grupo_id', ids).order('inicio', { ascending: false }))]) : [[], []];
  main.innerHTML = `${head(area != null ? AREAS[area] : 'Docente', 'Mis reportes')}
    ${!ids.length ? `<div class="alert a-info">${ic('i-info')}<div><b>Aún no tiene grupos asignados</b>Pida a la coordinación que le asigne sus grupos.</div></div>` : ''}
    <div class="card"><p class="small muted">Elija un simulacro terminado. Verá los resultados de ${area != null ? AREAS[area] : 'su área'} en su grupo, el análisis pregunta por pregunta y sugerencias para la clase.</p>${listaAplicaciones(apls, grupos)}</div>
    ${grupos.length ? `<div class="card"><div class="row between"><div><span class="lbl">Evolución</span><h2>¿Cómo van mis grupos?</h2></div><select id="evg" aria-label="Grupo">${grupos.map(x => `<option value="${x.id}">Grupo ${x.grado}-${esc(x.nombre)}</option>`).join('')}</select></div><div id="evo">${cargando()}</div><p class="xs muted">Promedio de todas las áreas. Su área aparece en la tabla.</p></div>` : ''}
    ${avHTML ? `<div class="bento">${avHTML}</div>` : ''}${corp}`;
  const evo = async () => { const el = $('#evo'); if (!el) return; el.innerHTML = cargando(); try { el.innerHTML = evolucionHTML(await rpc('evolucion_grupo', { p_grupo: $('#evg').value })); } catch (e) { el.innerHTML = `<p class="small muted">${esc(errorMsg(e))}</p>`; } };
  evo();
  main.onchange = e => { if (e.target.id === 'evg') evo(); };
  main.onclick = e => { const b = e.target.closest('[data-rep]'); if (b) go('reportes/' + b.dataset.rep); };
}
