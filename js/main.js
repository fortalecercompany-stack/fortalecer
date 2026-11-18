// FORTALECER · arranque, ingreso y navegación
import { $, $$, esc, ic, toast, errorMsg, modal, cerrarModal, corp, escudo, iniciales, setCortes, field, aplicarColor } from './lib.js';
import { sb, configurado, rpc, correoIngreso, borrarSesionLocal } from './api.js';

export const S = { sesion: null, perfil: null, colegio: null, grupo: null, periodo: null, recuperando: false };

// Menú: los elementos con lista se abren como menú desplegable (en el celular, como hoja inferior).
// [ruta, texto, ícono, [hijos: [ruta, texto, ícono, descripción]]]. Una ruta que empieza con @ es una acción.
const NAV = {
  admin: [['inicio', 'Inicio', 'i-home'], ['colegios', 'Colegios', 'i-school'],
    ['g-banco', 'Banco ICFES', 'i-bank', [['preguntas', 'Preguntas', 'i-bank', 'Revisar y cargar las preguntas del ICFES'], ['simulacros', 'Simulacros', 'i-exam', 'Armar y publicar los 20 simulacros']]],
    ['reportes', 'Reportes', 'i-results'], ['usuarios', 'Usuarios', 'i-users']],
  soporte: [['inicio', 'Inicio', 'i-home'], ['colegios', 'Colegios', 'i-school'], ['reportes', 'Reportes', 'i-results'], ['usuarios', 'Usuarios', 'i-users']],
  coordinador: [['inicio', 'Inicio', 'i-home'],
    ['g-personas', 'Personas', 'i-users', [['estudiantes', 'Estudiantes y grupos', 'i-users', 'Matrícula, autorizaciones y contraseñas'], ['docentes', 'Docentes y materias', 'i-teacher', 'Quién enseña qué en cada grupo']]],
    ['g-icfes', 'Simulacros', 'i-cal', [['simulacros', 'Programar simulacros', 'i-cal', 'Fecha y tiempo para cada grupo'], ['reportes', 'Reportes ICFES', 'i-results', 'Resultados, niveles y sala en vivo'], ['ranking', 'Ranking', 'i-trophy', 'Puestos en todo el colegio']]],
    ['g-notas', 'Exámenes y notas', 'i-exam', [['examenes', 'Exámenes de docentes', 'i-exam', 'Lo que han programado y sus resultados'], ['notas', 'Notas del período', 'i-list', 'Por grupo y por materia'], ['boletines', 'Boletines', 'i-down', 'Para entregar a los padres']]],
    ['g-colegio', 'Colegio', 'i-gear', [['ajustes', 'Períodos, escala y color', 'i-palette', 'Configuración del año escolar'], ['cierre', 'Cierre del año', 'i-archive', 'Respaldo y paso de grado']]]],
  docente: [['inicio', 'Inicio', 'i-home'],
    ['g-examenes', 'Exámenes', 'i-exam', [['examenes', 'Mis exámenes', 'i-exam', 'Programar, vigilar y calificar'], ['banco', 'Mi banco de preguntas', 'i-bank', 'Solo usted lo ve'], ['@nuevo', 'Crear examen', 'i-plus', 'Empezar uno nuevo ahora']]],
    ['notas', 'Mis grupos', 'i-users'], ['reportes', 'Resultados ICFES', 'i-results']],
  estudiante: [['inicio', 'Inicio', 'i-home'], ['notas', 'Mis notas', 'i-list'], ['resultados', 'Resultados ICFES', 'i-results'], ['refuerzo', 'Plan de refuerzo', 'i-up']],
};
// Pantallas internas que pertenecen a una sección del menú
const DE = { colegios: 'colegios', editor: 'examenes', resultados_ex: 'examenes', examen: 'inicio', prueba: 'inicio', honor: 'resultados', perfil: '' };
const TC = ['var(--a1)', 'var(--a2)', 'var(--a3)', 'var(--a4)', 'var(--a5)'];
const TS = ['var(--a1s)', 'var(--a2s)', 'var(--a3s)', 'var(--a4s)', 'var(--a5s)'];
const MODULO = { admin: './admin.js', soporte: './admin.js', coordinador: './coord.js', docente: './docente.js', estudiante: './est.js' };
const ROL_TXT = { admin: 'Administrador', soporte: 'Soporte', coordinador: 'Coordinación', docente: 'Docente', estudiante: 'Estudiante' };
const primeraRuta = rol => { const x = (NAV[rol] || [])[0]; return x ? x[0] : 'inicio'; };
const todas = rol => (NAV[rol] || []).flatMap(x => x[3] ? x[3].map(h => h[0]) : [x[0]]);

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
  const p = S.perfil;
  if (p) document.documentElement.classList.remove('en-login');
  const logoF = `<svg width="28" height="31" aria-hidden="true"><use href="#logo"/></svg>`;
  if (!p || p.debe_cambiar_clave) { $('#top').innerHTML = `<div class="in"><span class="brand">${logoF}<b>FORTALECER</b></span></div>`; $('#bnav').hidden = true; pintarAyuda(false); return; }
  const marca = S.colegio
    ? `<button class="brand" type="button" data-ir="${primeraRuta(p.rol)}" aria-label="Ir al inicio">${escudo(S.colegio.escudo_url, S.colegio.nombre, 38)}<span><b>${esc(S.colegio.nombre)}</b><span class="sub">${S.grupo ? `Grado ${S.grupo.grado}-${esc(S.grupo.nombre)}` : esc(S.colegio.municipio || '')}</span></span></button>`
    : `<button class="brand" type="button" data-ir="inicio" aria-label="Ir al inicio">${logoF}<span><b>FORTALECER</b><span class="sub">${ROL_TXT[p.rol]}</span></span></button>`;
  const oscuro = (document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')) === 'dark';
  const ruta = seccionMenu();
  const nav = NAV[p.rol] || [];
  const tabs = nav.map(([k, l, i, h], n) => {
    if (!h) return `<button class="tab" type="button" data-ir="${k}" ${ruta === k ? 'aria-current="page"' : ''}>${esc(l)}</button>`;
    const act = h.some(x => x[0] === ruta);
    return `<div class="nv"><button class="tab" type="button" data-dd aria-haspopup="true" aria-expanded="false" ${act ? 'aria-current="page"' : ''}>${esc(l)}${ic('i-chevd', 15)}</button><div class="dd" role="menu"><div class="dd-in">${h.map(([v, lh, ih, d], j) => `<button class="dd-it" type="button" role="menuitem" ${v[0] === '@' ? `data-accion="${v.slice(1)}"` : `data-ir="${v}"`} ${ruta === v ? 'aria-current="page"' : ''}><span class="aico" style="background:${TS[(n + j) % 5]};color:${TC[(n + j) % 5]}">${ic(ih, 19)}</span><span><b>${esc(lh)}</b><small>${esc(d)}</small></span></button>`).join('')}</div></div></div>`;
  }).join('');
  $('#top').innerHTML = `<div class="in">${marca}<nav class="tnav" aria-label="Secciones">${tabs}<span class="tind" aria-hidden="true"></span></nav><div class="right">
    <button class="bell" type="button" data-tema aria-label="Cambiar tema">${ic(oscuro ? 'i-sun' : 'i-moon', 19)}</button>
    <span class="who"><b>${esc(p.nombres)} ${esc(p.apellidos)}</b><small>${ROL_TXT[p.rol]}</small></span>
    <button class="av" type="button" data-menu aria-label="Mi cuenta" style="border:0;cursor:pointer">${esc(iniciales(p.nombres + ' ' + p.apellidos))}</button></div></div>`;
  $('#bnav').hidden = false;
  $('#bnav').innerHTML = nav.slice(0, 5).map(([k, l, i, h]) => `<button type="button" ${h ? `data-hoja="${k}"` : `data-ir="${k}"`} ${(h ? h.some(x => x[0] === ruta) : ruta === k) ? 'aria-current="page"' : ''}>${ic(i, 20)}<span>${l}</span></button>`).join('');
  pintarAyuda(true);
}
function seccionMenu() {
  const r = actual().seccion; if (!S.perfil) return r;
  if (todas(S.perfil.rol).includes(r)) return r;
  return DE[r] ?? r;
}
// En el celular, un grupo del menú se abre como lista
function hojaMenu(k) {
  const g = (NAV[S.perfil.rol] || []).find(x => x[0] === k); if (!g) return;
  modal({ icon: g[2], titulo: g[1], cuerpo: `<div style="display:grid;gap:6px">${g[3].map(([v, l, i, d], j) => `<button class="dd-it" type="button" ${v[0] === '@' ? `data-accion="${v.slice(1)}"` : `data-ir="${v}"`}><span class="aico" style="background:${TS[j % 5]};color:${TC[j % 5]}">${ic(i, 19)}</span><span><b>${esc(l)}</b><small>${esc(d)}</small></span></button>`).join('')}</div>` });
}
// ---------- Ayuda flotante ----------
const AYUDA = {
  admin: [['¿Por dónde empiezo?', 'Primero cargue el banco inicial en <b>Banco ICFES › Preguntas</b>. Luego arme y publique los simulacros en <b>Banco ICFES › Simulacros</b>. Por último cree cada colegio con su coordinador en <b>Colegios</b>.', 'colegios'],
    ['¿Cómo pongo el color y la escala de un colegio?', 'Al crear o editar el colegio, en el primer paso elige el color, la nota mínima, la máxima y la nota para aprobar. El coordinador también puede ajustarlos.', 'colegios'],
    ['Un coordinador olvidó su contraseña', 'Abra el colegio y pulse la llave junto al coordinador. La contraseña vuelve a ser su número de documento. También puede recuperarla con su correo.', 'colegios'],
    ['¿Qué significan las alertas de colegios?', '<b>Sin actividad</b>: nadie ha entrado en 15 días. <b>Sospechas</b>: 5 o más exámenes o simulacros cerrados por copia en una semana.', 'inicio']],
  soporte: [['¿Qué puedo hacer como soporte?', 'Consultar colegios y reportes, y ayudar a los usuarios con sus contraseñas en <b>Usuarios</b>.', 'usuarios']],
  coordinador: [['¿Qué hago al empezar el año?', '1) En <b>Colegio › Períodos, escala y color</b> cree los períodos. 2) En <b>Personas</b> cree los grupos y cargue a los estudiantes. 3) Registre a los docentes y asígneles sus materias.', 'ajustes'],
    ['¿Cómo asigno las materias a un docente?', 'En <b>Personas › Docentes y materias</b>, pulse el botón de materias del docente y marque qué materia dicta en cada grupo.', 'docentes'],
    ['Un estudiante se quedó sin tiempo', 'En la sala en vivo de <b>Inicio</b>, toque al estudiante y amplíe su tiempo. Conserva sus respuestas.', 'inicio'],
    ['¿Cómo saco los boletines?', 'En <b>Exámenes y notas › Boletines</b>, elija el grupo y el período y pulse <b>Imprimir boletines</b>. Puede guardarlos en PDF.', 'boletines'],
    ['Terminó el año, ¿qué hago?', 'En <b>Colegio › Cierre del año</b>: primero descargue el respaldo en Excel; luego confirme. Los grupos suben un grado y las cuentas de 11.º se borran.', 'cierre']],
  docente: [['¿Cómo creo un examen?', 'En <b>Exámenes › Crear examen</b>. Escriba las preguntas o tráigalas de su banco o de un Excel. Elija los grupos, el horario y pulse <b>Programar</b>.', '@nuevo'],
    ['¿Qué tipos de pregunta hay?', 'Una correcta, varias correctas, falso o verdadero, completar, relacionar, ordenar pasos y lectura con varias preguntas. El sistema califica todas.', 'examenes'],
    ['Un estudiante necesita más tiempo', 'Abra los resultados del examen, toque al estudiante y use <b>Darle más tiempo</b>. Sirve aunque no haya empezado.', 'examenes'],
    ['¿Por qué no puedo cambiar un examen?', 'Cuando un estudiante ya lo presentó, se bloquea para que todos tengan el mismo examen. Use <b>Duplicar</b> para hacer una versión nueva.', 'examenes']],
  estudiante: [['¿Cuál es mi usuario?', 'Su número de documento. La contraseña la creó usted en su primer ingreso; si la olvidó, pídale al coordinador que la restablezca.'],
    ['Se fue el internet en pleno examen', 'Siga respondiendo: sus respuestas se guardan en el equipo y se envían solas cuando vuelva la conexión. Puede volver a entrar mientras no se acabe el tiempo.'],
    ['¿Cuándo veo mi nota?', 'En los exámenes de los docentes, al entregar. En los simulacros, cuando termina el tiempo para todo el grupo.'],
    ['¿Qué pasa si salgo de la ventana?', 'Si el examen tiene control contra la copia, la primera vez sale una advertencia y la segunda el examen se cierra. Solo su docente puede habilitarlo de nuevo.']],
};
let ayudaAbierta = false;
function pintarAyuda(mostrar) {
  const box = $('#ayudabox'); if (!box) return;
  if (!mostrar || !S.perfil) { box.innerHTML = ''; return; }
  const L = AYUDA[S.perfil.rol] || [];
  box.innerHTML = `<button class="fab" type="button" data-ayuda aria-expanded="${ayudaAbierta}" aria-label="Ayuda">${ic(ayudaAbierta ? 'i-x' : 'i-help', 20)}<span>Ayuda</span></button>${ayudaAbierta ? `<div class="ayuda" role="dialog" aria-label="Ayuda"><div class="ah"><b>¿En qué le ayudamos?</b><span>Toque una pregunta para ver la respuesta.</span></div><div class="ab">${L.map(([qq, r, v], i) => `<details class="acc"${i === 0 ? ' open' : ''}><summary>${qq}${ic('i-chevd', 16)}</summary><div class="acb"><p>${r}</p>${v ? `<button class="btn sec sm" type="button" ${v[0] === '@' ? `data-accion="${v.slice(1)}"` : `data-ir="${v}"`}>Ir allí <span class="fl">→</span></button>` : ''}</div></details>`).join('')}</div></div>` : ''}`;
}
document.addEventListener('click', e => {
  const t = e.target.closest('button');
  if (!t) { if (ayudaAbierta && !e.target.closest('.ayuda')) { ayudaAbierta = false; pintarAyuda(true); } return; }
  if ('dd' in t.dataset) { const n = t.closest('.nv'), ab = !n.classList.contains('open'); $$('.nv.open').forEach(x => x.classList.remove('open')); if (ab) n.classList.add('open'); return; }
  if (t.dataset.ir) { $$('.nv.open').forEach(x => x.classList.remove('open')); if (ayudaAbierta) { ayudaAbierta = false; pintarAyuda(true); } cerrarModal(); go(t.dataset.ir); }
  if (t.dataset.accion === 'nuevo') { $$('.nv.open').forEach(x => x.classList.remove('open')); ayudaAbierta = false; pintarAyuda(true); cerrarModal(); go('editor/nuevo'); }
  if (t.dataset.hoja) hojaMenu(t.dataset.hoja);
  if ('ayuda' in t.dataset) { ayudaAbierta = !ayudaAbierta; pintarAyuda(true); return; }
  if (ayudaAbierta && !t.closest('.ayuda')) { ayudaAbierta = false; pintarAyuda(true); }
  if ('tema' in t.dataset) cambiarTema();
  if ('menu' in t.dataset) menuCuenta();
  if ('salir' in t.dataset) salir();
  if ('cambiarClave' in t.dataset) { cerrarModal(); pantallaClave(false); }
});
document.addEventListener('click', e => { if (!e.target.closest('.nv')) $$('.nv.open').forEach(x => x.classList.remove('open')); });
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
  marco(); document.documentElement.classList.add('en-login');
  main().innerHTML = `<div class="loginwrap">
    <div class="hero acceso" aria-hidden="true">
      <div class="llave">
        <svg viewBox="0 0 220 240" class="escudo-acceso">
          <defs><linearGradient id="gEsc" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4556B8"/><stop offset="1" stop-color="#1C2766"/></linearGradient></defs>
          <circle cx="110" cy="120" r="104" fill="none" stroke="rgba(255,255,255,.16)" stroke-width="2" stroke-dasharray="4 10"/>
          <circle class="g2" cx="110" cy="120" r="84" fill="none" stroke="rgba(224,86,47,.6)" stroke-width="2" stroke-dasharray="40 14"/>
          <g class="g3"><circle cx="214" cy="120" r="5" fill="#FF9A7A"/></g>
          <path d="M110 44 L166 64 V112 C166 150 142 174 110 188 C78 174 54 150 54 112 V64 Z" fill="url(#gEsc)" stroke="rgba(255,255,255,.35)" stroke-width="2"/>
          <rect x="86" y="108" width="48" height="40" rx="8" fill="#FFFFFF"/>
          <path d="M94 108 V96 a16 16 0 0 1 32 0 V108" fill="none" stroke="#FFFFFF" stroke-width="7" stroke-linecap="round"/>
          <circle cx="110" cy="124" r="6" fill="#E0562F"/><rect x="107.5" y="126" width="5" height="12" rx="2.5" fill="#E0562F"/>
        </svg>
      </div>
      <div class="marca"><svg width="34" height="37"><use href="#logo-w"/></svg><b>FORTALECER</b></div>
    </div>
    <form id="flogin" novalidate><div style="display:grid;gap:4px"><span class="lbl" style="color:var(--coral-ink)">Bienvenido</span><h2>Ingresar</h2></div>
      ${field('u', 'Usuario', '', 'autocomplete="username" required', 'Estudiantes: número de documento. Docentes, coordinadores y administrador: correo.')}
      ${field('pw', 'Contraseña', '', 'type="password" autocomplete="current-password" required')}
      <p id="lerr" class="small" style="color:var(--bad)" hidden></p>
      <button class="btn pri" type="submit" id="lbtn" style="min-height:54px;font-size:16.5px">Ingresar <span class="fl">→</span></button>
      <button class="linkbtn small" type="button" id="olvide" style="justify-self:start">Olvidé mi contraseña</button>
      <div class="ayudaclave"><span class="lbl">¿Cuál es mi contraseña?</span><span><b>La primera vez:</b> su número de documento.</span><span><b>Después:</b> la que usted creó en su primer ingreso.</span></div>
      ${corp}</form></div>`;
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
  if (!r.seccion) { location.replace('#/' + primeraRuta(S.perfil.rol)); return; }
  marco();
  const id = ++render_id;
  try {
    const mod = await import(MODULO[S.perfil.rol]);
    if (id !== render_id) return;
    document.body.classList.remove('focus');
    const m = main(); m.onclick = m.onchange = m.oninput = m.onsubmit = null;
    await mod.render({ S, main: m, seccion: r.seccion, params: r.params, go, recargar: router });
    document.dispatchEvent(new Event('f-pintado'));
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
  S.perfil = ses.perfil; S.colegio = ses.colegio; S.grupo = ses.grupo; S.periodo = ses.periodo;
  aplicarColor(S.colegio?.color);
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
// Se puede instalar en el celular como aplicación
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => { });
arrancar();
