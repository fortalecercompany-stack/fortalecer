// FORTALECER · conexión con la base de datos (Supabase)
const cfg = window.FORTALECER_CONFIG || {};
export const configurado = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && !/PEGUE|xxxx/i.test(cfg.SUPABASE_URL + cfg.SUPABASE_ANON_KEY));
// Seguridad: la sesión se guarda solo en esta pestaña (sessionStorage).
// Al cerrar el navegador la sesión se pierde y hay que ingresar de nuevo.
export const CLAVE_SESION = 'f-sesion';
const almacen = (() => { try { const x = window.sessionStorage; x.setItem('f-prueba', '1'); x.removeItem('f-prueba'); return x; } catch { return undefined; } })();
// Borra sesiones que versiones anteriores dejaron guardadas de forma permanente.
try { Object.keys(localStorage).filter(k => /^sb-.*-auth-token/.test(k)).forEach(k => localStorage.removeItem(k)); } catch { }
export const sb = configurado ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
  auth: { storage: almacen, storageKey: CLAVE_SESION, persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
}) : null;
export function borrarSesionLocal() {
  for (const st of [(() => { try { return sessionStorage; } catch { return null; } })(), (() => { try { return localStorage; } catch { return null; } })()]) {
    if (!st) continue;
    try { Object.keys(st).filter(k => k.startsWith(CLAVE_SESION) || /^sb-.*-auth-token/.test(k)).forEach(k => st.removeItem(k)); } catch { }
  }
}
export const DOMINIO_ESTUDIANTES = 'estudiantes.fortalecer.app';

// Lanza un error legible si la consulta falla
export async function q(p) {
  const { data, error, count } = await p;
  if (error) throw new Error(error.message);
  return count !== undefined && count !== null ? { data, count } : data;
}
export const rpc = (fn, args = {}) => q(sb.rpc(fn, args));

export async function usuarios(body) {
  const { data, error } = await sb.functions.invoke('usuarios', { body });
  if (error) {
    let msg = error.message;
    try { const j = await error.context.json(); if (j?.error) msg = j.error; } catch { /* sin detalle */ }
    if (/Failed to send|not found|404/i.test(msg)) msg = 'No se encontró la función «usuarios» en Supabase. Revise el paso 5 de la guía.';
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

export function correoIngreso(usuario) {
  const u = String(usuario || '').trim();
  return u.includes('@') ? u.toLowerCase() : `${u.replace(/\D/g, '')}@${DOMINIO_ESTUDIANTES}`;
}

export async function subirArchivo(bucket, file, nombre) {
  const ext = (file.name.split('.').pop() || 'png').toLowerCase();
  const ruta = `${nombre}-${Date.now()}.${ext}`;
  const { error } = await sb.storage.from(bucket).upload(ruta, file, { upsert: true, contentType: file.type });
  if (error) throw new Error(error.message);
  return sb.storage.from(bucket).getPublicUrl(ruta).data.publicUrl;
}
