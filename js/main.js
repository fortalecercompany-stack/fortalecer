// FORTALECER · arranque, ingreso y navegación
import { $, esc, ic, toast, errorMsg, modal, cerrarModal, corp, escudo, iniciales, setCortes, field } from './lib.js';
import { sb, configurado, rpc, correoIngreso, borrarSesionLocal } from './api.js';

export const S = { sesion: null, perfil: null, colegio: null, grupo: null, recuperando: false };

const NAV = {
  admin: [['inicio', 'Inicio', 'i-home'], ['colegios', 'Colegios', 'i-school'], ['preguntas', 'Preguntas', 'i-bank'], ['simulacros', 'Simulacros', 'i-exam'], ['reportes', 'Reportes', 'i-results'], ['usuarios', 'Usuarios', 'i-users']],
  soporte: [['inicio', 'Inicio', 'i-home'], ['colegios', 'Colegios', 'i-school'], ['reportes', 'Reportes', 'i-results'], ['usuarios', 'Usuarios', 'i-users']],
  coordinador: [['inicio', 'Inicio', 'i-home'], ['estudiantes', 'Estudiantes', 'i-users'], ['docentes', 'Docentes', 'i-teacher'], ['simulacros', 'Simulacros', 'i-cal'], ['reportes', 'Reportes', 'i-results']],
  docente: [['reportes', 'Mis reportes', 'i-results'], ['perfil', 'Perfil', 'i-user']],
  estudiante: [['inicio', 'Inicio', 'i-home'], ['resultados', 'Resultados', 'i-results'], ['perfil', 'Perfil', 'i-user']],
};
const MODULO = { admin: './admin.js', soporte: './admin.js', coordinador: './coord.js', docente: './docente.js', estudiante: './est.js' };
const ROL_TXT = { admin: 'Administrador', soporte: 'Soporte', coordinador: 'Coordinación', docente: 'Docente', estudiante: 'Estudiante' };

export const go = ruta => { if (location.hash !== '#/' + ruta) location.hash = '#/' + ruta; else router(); };
const main = () => $('#main');

// ---------- Tema ----------
try { const t = localStorage.getItem('f-tema'); if (t) document.documentElement.dataset.theme = t; } catch { }
function cambiarTema() {
  const cur = document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const nuevo = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = nuevo;
  try { localStorage.setItem('f-tema', nuevo); } catch { }
  marco();
}

// ---------- Marco ----------
function marco() {
  const brand = `<div class="brand"><svg width="28" height="31" aria-hidden="true"><use href="#logo"/></svg><b>FORTALECER</b></div>`;
  const p = S.perfil;
  if (!p || p.debe_cambiar_clave) { $('#top').innerHTML = `<div class="in">${brand}</div>`; $('#bnav').hidden = true; return; }
  const esc_ = S.colegio ? `<div class="school">${escudo(S.colegio.escudo_url, S.colegio.nombre, 36)}<span><b>${esc(S.colegio.nombre)}</b><br><small>${S.grupo ? `Grado ${S.grupo.grado}-${esc(S.grupo.nombre)}` : esc(S.colegio.municipio || '')}</small></span></div>` : `<div class="school"><span class="crest" style="background:var(--coral-soft);color:var(--coral-ink)">${ic('i-school', 18)}</span><span><b>Panel general</b><br><small>${ROL_TXT[p.rol]}</small></span></div>`;
  const oscuro = (document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')) === 'dark';
  $('#top').innerHTML = `<div class="in">${brand}${esc_}<div class="right">
    <button class="bell hide-s" type="button" data-tema aria-label="Cambiar tema">${ic(oscuro ? 'i-sun' : 'i-moon', 19)}</button>
    <span class="who"><b>${esc(p.nombres)} ${esc(p.apellidos)}</b><small>${ROL_TXT[p.rol]}</small></span>
    <button class="av" type="button" data-menu aria-label="Mi cuenta" style="border:0;cursor:pointer">${esc(iniciales(p.nombres + ' ' + p.apellidos))}</button></div></div>`;
  const ruta = actual().seccion;
  const nav = NAV[p.rol] || [];
  $('#bnav').hidden = false;
  $('#bnav').innerHTML = nav.map(([k, l, i]) => `<button type="button" data-ir="${k}" ${ruta === k ? 'aria-current="page"' : ''}>${ic(i, 20)}<span>${l}</span></button>`).join('');
}
document.addEventListener('click', e => {
  const t = e.target.closest('button'); if (!t) return;
  if (t.dataset.ir) go(t.dataset.ir);
  if ('tema' in t.dataset) cambiarTema();
  if ('menu' in t.dataset) menuCuenta();
  if ('salir' in t.dataset) salir();
  if ('cambiarClave' in t.dataset) { cerrarModal(); pantallaClave(false); }
});
function menuCuenta() {
  const p = S.perfil;
  modal({ icon: 'i-user', titulo: `${esc(p.nombres)} ${esc(p.apellidos)}`, sub: `${ROL_TXT[p.rol]}${S.colegio ? ' · ' + esc(S.colegio.nombre) : ''}`,
    cuerpo: `<div style="display:grid;gap:10px"><button class="btn sec" type="button" data-cambiar-clave>${ic('i-key')}Cambiar contraseña</button><button class="btn sec" type="button" data-tema>${ic('i-moon')}Cambiar tema claro u oscuro</button><button class="btn ghost" type="button" data-salir style="color:var(--bad)">${ic('i-exit')}Cerrar sesión</button></div>` });
}
// Cierre de sesión seguro: invalida la sesión en el servidor, borra todo rastro local y recarga la página.
export async function salir(mensaje = '') {
  cerrarModal();
  S.perfil = null; S.colegio = null; S.grupo = null;
  try { await Promise.race([sb?.auth.signOut(), new Promise(r => setTimeout(r, 2500))]); } catch { }
  borrarSesionLocal();
  try { localStorage.removeItem('f-actividad'); if (mensaje) sessionStorage.setItem('f-aviso', mensaje); } catch { }
  location.replace(location.pathname);
}

// ---------- Cierre por inactividad ----------
// Sin actividad durante este tiempo, la sesión se cierra sola (también si el equipo se apagó con la sesión abierta).
const LIMITE_MIN = { estudiante: 30, docente: 20, coordinador: 20, soporte: 20, admin: 20 };
const limiteMs = () => (LIMITE_MIN[S.perfil?.rol] || 20) * 60000;
const enExamen = () => document.body.classList.contains('focus');
let ultimaMarca = 0;
function marcarActividad() {
  const t = Date.now(); if (t - ultimaMarca < 5000) return; ultimaMarca = t;
  try { localStorage.setItem('f-actividad', String(t)); } catch { }
}
['pointerdown', 'keydown', 'scroll', 'touchstart', 'mousemove'].forEach(ev => document.addEventListener(ev, marcarActividad, { passive: true, capture: true }));
const ultimaActividad = () => { try { return +localStorage.getItem('f-actividad') || 0; } catch { return 0; } };
setInterval(() => {
  if (!S.perfil || enExamen()) { if (enExamen()) marcarActividad(); return; }
  if (Date.now() - ultimaActividad() > limiteMs()) salir('Su sesión se cerró por inactividad. Ingrese de nuevo.');
}, 30000);

// ---------- Pantallas de ingreso ----------
function pantallaIngreso() {
  marco();
  main().innerHTML = `<div class="loginwrap fade">
    <div class="hero acceso" aria-hidden="true">
      <div class="llave">
        <svg viewBox="0 0 220 240" class="escudo-acceso">
          <defs><linearGradient id="gEsc" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4556B8"/><stop offset="1" stop-color="#1C2766"/></linearGradient></defs>
          <circle cx="110" cy="120" r="104" fill="none" stroke="rgba(255,255,255,.14)" stroke-width="2" stroke-dasharray="4 10"/>
          <circle cx="110" cy="120" r="84" fill="none" stroke="rgba(224,86,47,.45)" stroke-width="2"/>
          <path d="M110 44 L166 64 V112 C166 150 142 174 110 188 C78 174 54 150 54 112 V64 Z" fill="url(#gEsc)" stroke="rgba(255,255,255,.35)" stroke-width="2"/>
          <rect x="86" y="108" width="48" height="40" rx="8" fill="#FFFFFF"/>
          <path d="M94 108 V96 a16 16 0 0 1 32 0 V108" fill="none" stroke="#FFFFFF" stroke-width="7" stroke-linecap="round"/>
          <circle cx="110" cy="124" r="6" fill="#E0562F"/><rect x="107.5" y="126" width="5" height="12" rx="2.5" fill="#E0562F"/>
        </svg>
      </div>
      <div class="marca"><svg width="30" height="33"><use href="#logo"/></svg><b>FORTALECER</b></div>
      <div class="pasos"><span><i>1</i>Usuario</span><span class="sep"></span><span><i>2</i>Contraseña</span><span class="sep"></span><span><i>${ic('i-sync', 13)}</i>Ingresar</span></div>
    </div>
    <form id="flogin" novalidate><div style="display:grid;gap:4px"><span class="lbl">Bienvenido</span><h2 style="font-size:26px">Ingresar</h2></div>
      ${field('u', 'Usuario', '', 'autocomplete="username" required', 'Estudiantes: número de documento. Coordinadores, docentes y administrador: correo.')}
      ${field('pw', 'Contraseña', '', 'type="password" autocomplete="current-password" required')}
      <p id="lerr" class="small" style="color:var(--bad)" hidden></p>
      <button class="btn pri" type="submit" id="lbtn">Ingresar</button>
      <button class="linkbtn small" type="button" id="olvide" style="justify-self:start">Olvidé mi contraseña</button>
      </form></div>${corp}`;
  let aviso = ''; try { aviso = sessionStorage.getItem('f-aviso') || ''; sessionStorage.removeItem('f-aviso'); } catch { }
  if (aviso) { const e = $('#lerr'); e.textContent = aviso; e.hidden = false; e.style.color = 'var(--warn)'; }
  $('#flogin').onsubmit = async e => {
    e.preventDefault();
    const u = $('#u').value.trim(), pw = $('#pw').value, err = $('#lerr'), btn = $('#lbtn');
    err.hidden = true;
    if (!u || !pw) { err.textContent = 'Escriba su usuario y su contraseña.'; err.hidden = false; return; }
    btn.disabled = true; btn.textContent = 'Ingresando…';
    const { error } = await sb.auth.signInWithPassword({ email: correoIngreso(u), password: pw });
    btn.disabled = false; btn.textContent = 'Ingresar';
    if (error) {
      err.textContent = /Invalid login/i.test(error.message) ? 'El usuario o la contraseña no coinciden. Revíselos e intente de nuevo.' : /banned/i.test(error.message) ? 'Su cuenta está desactivada. Comuníquese con la coordinación de su colegio.' : errorMsg(error);
      err.hidden = false; return;
    }
    marcarActividad(); ultimaMarca = 0; marcarActividad();
    arrancar();
  };
  $('#olvide').onclick = () => {
    const w = modal({ icon: 'i-key', titulo: 'Recuperar contraseña', form: true,
      cuerpo: `<div class="alert a-info">${ic('i-info')}<div><b>¿Es estudiante?</b>Pida al coordinador de su colegio que restablezca su contraseña.</div></div>${field('rc', 'Correo de coordinador, docente o administrador', '', 'type="email" required')}<p class="xs muted">Le llegará un enlace para crear una contraseña nueva.</p>`,
      pie: `<button class="btn sec" type="button" data-cerrar>Cancelar</button><button class="btn pri" type="submit">Enviar enlace</button>` });
    w.querySelector('form').onsubmit = async e => {
      e.preventDefault();
      const c = $('#rc').value.trim(); if (!c.includes('@')) return toast('Escriba un correo válido.', 'error');
      const { error } = await sb.auth.resetPasswordForEmail(c, { redirectTo: location.origin + location.pathname });
      if (error) return toast(errorMsg(error), 'error');
      cerrarModal(); toast('Si el correo está registrado, le llegará el enlace en unos minutos. Revise también la carpeta de spam.');
    };
  };
}

function pantallaClave(primera) {
  marco();
  main().innerHTML = `<div class="card fade" style="max-width:520px;width:100%;margin:10px auto">
    <div class="alert a-info">${ic('i-key')}<div><b>${primera ? `Bienvenido${S.perfil?.nombres ? ', ' + esc(S.perfil.nombres.split(' ')[0]) : ''}. Es su primer ingreso` : S.recuperando ? 'Cree su contraseña nueva' : 'Cambiar contraseña'}</b>${primera ? 'Usted entró con la contraseña inicial, que es su número de documento. Por seguridad, cree ahora una contraseña personal. Desde hoy entrará con su mismo usuario y esta contraseña nueva.' : 'Use una que pueda recordar.'}</div></div>
    <form id="fclave" novalidate style="display:grid;gap:14px">
      ${field('n1', 'Nueva contraseña', '', 'type="password" autocomplete="new-password"', 'Mínimo 8 caracteres, con letras y números.')}
      ${field('n2', 'Repita la nueva contraseña', '', 'type="password" autocomplete="new-password"')}
      <p id="cerr" class="small" style="color:var(--bad)" hidden></p>
      <div class="row"><button class="btn pri" type="submit">Guardar contraseña</button>${!primera && !S.recuperando ? '<button class="btn ghost" type="button" id="cancel">Cancelar</button>' : ''}</div></form></div>${corp}`;
  if ($('#cancel')) $('#cancel').onclick = () => router();
  $('#fclave').onsubmit = async e => {
    e.preventDefault();
    const a = $('#n1').value, b = $('#n2').value, err = $('#cerr'); err.hidden = true;
    const mal = t => { err.textContent = t; err.hidden = false; };
    if (a.length < 8 || !/[a-zA-Z]/.test(a) || !/\d/.test(a)) return mal('La contraseña debe tener al menos 8 caracteres, con letras y números.');
    if (a !== b) return mal('Las dos contraseñas no son iguales.');
    const docN = String(S.perfil?.documento || '').replace(/\D/g, '');
    if (docN.length >= 5 && a.replace(/\D/g, '').includes(docN)) return mal('No use su número de documento dentro de la contraseña.');
    const { error } = await sb.auth.updateUser({ password: a });
    if (error) return mal(/should be different/i.test(error.message) ? 'La contraseña nueva debe ser diferente a la anterior.' : errorMsg(error));
    await rpc('marcar_clave_cambiada');
    S.recuperando = false;
    toast('Contraseña guardada.');
    arrancar();
  };
}

function pantallaMensaje(icon, titulo, texto, salirBtn = true) {
  marco();
  main().innerHTML = `<div class="card fade" style="max-width:560px;margin:20px auto;text-align:center;place-items:center"><span class="aico" style="width:64px;height:64px;background:var(--warn-soft);color:var(--warn)">${ic(icon, 30)}</span><h2>${titulo}</h2><p class="muted">${texto}</p>${salirBtn ? `<button class="btn sec" type="button" data-salir>${ic('i-exit')}Cerrar sesión</button>` : ''}</div>${corp}`;
}

// ---------- Rutas ----------
function actual() {
  const h = location.hash.replace(/^#\/?/, '');
  const [seccion, ...resto] = h.split('/');
  return { seccion: seccion || '', params: resto };
}
let render_id = 0;
export async function router() {
  if (!S.perfil) return;
  const r = actual();
  const nav = NAV[S.perfil.rol] || [];
  if (!r.seccion) { location.replace('#/' + nav[0][0]); return; }
  marco();
  const id = ++render_id;
  try {
    const mod = await import(MODULO[S.perfil.rol]);
    if (id !== render_id) return;
    document.body.classList.remove('focus');
    const m = main(); m.onclick = m.onchange = m.oninput = m.onsubmit = null;
    await mod.render({ S, main: m, seccion: r.seccion, params: r.params, go, recargar: router });
    window.scrollTo?.(0, 0);
  } catch (e) {
    console.error(e);
    main().innerHTML = `<div class="card" style="max-width:640px;margin:20px auto"><div class="alert a-warn">${ic('i-warn')}<div><b>No se pudo abrir esta pantalla</b>${esc(errorMsg(e))}</div></div><button class="btn sec" type="button" onclick="location.reload()">Intentar de nuevo</button></div>`;
  }
}
window.addEventListener('hashchange', router);

// ---------- Arranque ----------
export async function arrancar() {
  if (!configurado) {
    main().innerHTML = `<div class="card" style="max-width:640px;margin:30px auto"><div class="alert a-warn">${ic('i-warn')}<div><b>Falta conectar la base de datos</b>Abra el archivo <code>config.js</code> y pegue la dirección y la llave pública de su proyecto de Supabase (vea la guía de instalación).</div></div></div>`;
    return;
  }
  const { data: { session } } = await sb.auth.getSession();
  S.sesion = session;
  if (!session) { S.perfil = null; return pantallaIngreso(); }
  // Si la sesión quedó abierta y pasó demasiado tiempo sin uso, se cierra.
  const ua = ultimaActividad();
  if (!S.recuperando && ua && Date.now() - ua > 30 * 60000) return salir('Su sesión se cerró por inactividad. Ingrese de nuevo.');
  marcarActividad();
  if (S.recuperando) return pantallaClave(false);
  main().innerHTML = `<div class="card" style="place-items:center;padding:48px;margin-top:20px"><div class="spin"></div><span class="muted small">Cargando…</span></div>`;
  let ses;
  try { ses = await rpc('mi_sesion'); } catch (e) { return pantallaMensaje('i-offline', 'No hay conexión', esc(errorMsg(e))); }
  if (!ses || !ses.perfil) return pantallaMensaje('i-warn', 'Su usuario no tiene perfil', 'La cuenta existe, pero no está registrada en FORTALECER. Si es el administrador, ejecute el archivo <b>03_primer_administrador.sql</b> (vea la guía de instalación).');
  S.perfil = ses.perfil; S.colegio = ses.colegio; S.grupo = ses.grupo;
  if (!S.perfil.activo) return pantallaMensaje('i-exit', 'Su cuenta está desactivada', 'Comuníquese con la coordinación de su colegio.');
  if (S.colegio && !S.colegio.activo) return pantallaMensaje('i-school', 'El acceso de su colegio está suspendido', 'La información se conserva. Comuníquese con el administrador de FORTALECER.');
  try { const aj = await sb.from('ajustes').select('valor').eq('clave', 'cortes').maybeSingle(); if (aj.data) setCortes(aj.data.valor); } catch { }
  if (S.perfil.debe_cambiar_clave) return pantallaClave(true);
  router();
}

sb?.auth.onAuthStateChange((ev) => {
  if (ev === 'PASSWORD_RECOVERY') { S.recuperando = true; setTimeout(() => pantallaClave(false), 50); }
});
window.addEventListener('online', () => document.dispatchEvent(new Event('f-online')));
arrancar();
