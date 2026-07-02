// Protege todo el sitio (estático + funciones) con HTTP Basic Auth.
// Se activa solo si SITE_PASSWORD está configurada; si no, deja pasar todo
// (así el desarrollo local sin esa variable sigue funcionando sin fricción).
export default async (request, context) => {
  const password = Deno.env.get('SITE_PASSWORD');
  if (!password) return context.next();

  const user = Deno.env.get('SITE_USER') || 'admin';
  const authHeader = request.headers.get('authorization') || '';

  if (authHeader.startsWith('Basic ')) {
    const decoded = atob(authHeader.slice(6));
    const sep = decoded.indexOf(':');
    const suppliedUser = decoded.slice(0, sep);
    const suppliedPass = decoded.slice(sep + 1);
    if (suppliedUser === user && suppliedPass === password) {
      return context.next();
    }
  }

  return new Response('Authentication required', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Task Manager", charset="UTF-8"' },
  });
};

export const config = { path: '/*' };
