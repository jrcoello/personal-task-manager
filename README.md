# Task Manager Personal (Airtable + Netlify)

Task manager estático (HTML/CSS/JS) conectado a Airtable, pensado para un solo usuario, sin login.

## Estructura del proyecto

```
task-manager/
├── index.html
├── css/styles.css
├── js/
│   ├── config.js        # valores por default de negocio/estatus/prioridad (respaldo, sin secretos)
│   ├── api.js            # llama a la función de Netlify, nunca a Airtable directo
│   └── app.js             # lógica de dashboard, vistas, modal
├── netlify/
│   ├── functions/
│   │   ├── airtable.js   # proxy serverless: aquí vive el token, nunca en el navegador
│   │   └── schema.js     # lee las opciones reales de los campos select desde Airtable
│   └── edge-functions/
│       └── basic-auth.js # protección opcional de acceso (usuario/contraseña)
├── netlify.toml
├── package.json
└── .env.example
```

## Por qué el token no puede ir "directo" en el frontend

Un sitio estático (HTML/JS puro) se descarga completo al navegador del visitante. Cualquier valor que pongas
en un `.js` — aunque esté "escondido" u ofuscado — es visible con solo abrir las herramientas de desarrollador
del navegador. Si pusieras tu Personal Access Token de Airtable ahí, cualquiera que visite el sitio podría
copiarlo y leer/borrar/modificar todas tus tareas (o lo que sea que ese token pueda tocar).

**Solución:** una función serverless de Netlify (`netlify/functions/airtable.js`). Vive en el mismo repo,
se despliega junto con tu sitio (no es un "backend" que tengas que mantener aparte), pero corre en el
servidor de Netlify, no en el navegador. El token se guarda como variable de entorno en Netlify y la función
lo inyecta en cada llamada a Airtable. El navegador solo habla con `/.netlify/functions/airtable`, nunca con
`api.airtable.com` directamente, así que el token nunca sale del servidor.

---

## Paso 1 — Crear el Personal Access Token en Airtable

1. Ve a https://airtable.com/create/tokens
2. Click en **Create new token**.
3. Nombre: algo como `task-manager-netlify`.
4. **Scopes** necesarios:
   - `data.records:read`
   - `data.records:write`
   - `schema.bases:read` — para que el sitio pueda leer en vivo las opciones de los campos select (Business, Task Status, Priority) y no dependa de listas fijas en el código. Si renombras o agregas opciones en Airtable, aparecen solas en el sitio.
5. **Access**: agrega acceso específico a la base `apps6HOqFYkoY4AGu` (tu base de Tasks). No le des acceso a todas tus bases, solo a esta.
6. Crea el token y **cópialo de inmediato** (Airtable solo lo muestra una vez). Empieza con `pat...`.
7. Guárdalo en un gestor de contraseñas o similar — lo vas a necesitar en el Paso 4.

## Paso 2 — Probar localmente (opcional pero recomendado)

Necesitas Node.js y la CLI de Netlify.

```bash
cd task-manager
npm install
cp .env.example .env
```

Edita `.env` y pega tu token real:

```
AIRTABLE_TOKEN=pat_xxxxxxxxxxxxxxxxx
```

Corre el entorno local (sirve el sitio estático **y** simula las funciones serverless con las variables de `.env`):

```bash
npx netlify dev
```

Abre la URL que te muestre en consola (normalmente `http://localhost:8888`). Ya deberías poder ver tus tareas
reales de Airtable, crear una nueva, cambiar estatus y borrar.

`.env` está en `.gitignore` — nunca se sube a GitHub.

## Paso 3 — Subir el proyecto a GitHub

```bash
cd task-manager
git init
git add .
git commit -m "Task manager conectado a Airtable"
```

Crea un repo vacío en GitHub (desde la web o con `gh repo create`) y luego:

```bash
git remote add origin https://github.com/<tu-usuario>/<tu-repo>.git
git branch -M main
git push -u origin main
```

Confirma que `.env` **no** aparezca en el repo (revisa en GitHub o corre `git ls-files | grep .env`, solo debe
listar `.env.example`).

## Paso 4 — Deploy en Netlify

1. Entra a https://app.netlify.com y haz login.
2. **Add new site → Import an existing project**.
3. Conecta GitHub y selecciona el repo que acabas de crear.
4. Build settings (Netlify debería detectarlos solos gracias a `netlify.toml`, pero verifica):
   - **Build command**: (vacío — no hay build, es HTML/JS plano)
   - **Publish directory**: `.`
   - **Functions directory**: `netlify/functions`
5. Antes de darle "Deploy site", ve a **Site settings → Environment variables** (o hazlo justo después del
   primer deploy) y agrega:
   - `AIRTABLE_TOKEN` = tu Personal Access Token (`pat_...`), marcada como **"Contains secret values"**.
   - **No agregues** `AIRTABLE_BASE_ID` ni `AIRTABLE_TABLE_ID` en Netlify — ya tienen default en el código
     (`netlify/functions/airtable.js`), y si los marcas como secretos, el escáner de secretos de Netlify
     falla el build porque esos mismos valores están hardcodeados en el código fuente.
6. Dispara el deploy (**Deploy site** o **Trigger deploy → Deploy site** si ya existía).
7. Cuando termine, abre la URL `https://<tu-sitio>.netlify.app` y verifica que cargue tus tareas.

## Paso 5 — Verificación rápida post-deploy

- Dashboard: los contadores y la gráfica deben reflejar tus tareas reales.
- Crea una tarea de prueba desde el modal y confirma que aparece en Airtable.
- Cambia su estatus a "Completada" en la vista "Por Negocio" y confirma que `Completed Date` se llena en Airtable.
- Bórrala desde "Todas las Tareas" y confirma que desaparece también de Airtable.

## Paso 6 — Proteger el acceso al sitio (opcional)

Como no hay login, cualquiera con la URL puede ver y editar tus tareas. El plan gratuito de Netlify no incluye
la protección de sitio nativa ("Site protection" pide upgrade), así que `netlify/edge-functions/basic-auth.js`
implementa un HTTP Basic Auth propio (usuario/contraseña que pide el navegador antes de mostrar cualquier cosa).

1. En **Site configuration → Environment variables**, agrega `SITE_PASSWORD` (marca **"Contains secret values"**)
   con la contraseña que quieras, en el campo **Production**.
2. Opcional: agrega `SITE_USER` (si no lo pones, el usuario por default es `admin`).
3. Redeploy y prueba abriendo el sitio en una ventana incógnito — debe pedir usuario/contraseña.
4. Si dejas `SITE_PASSWORD` vacío o sin definir, el sitio queda sin protección (útil para desarrollo local).

## Notas de seguridad

- Nunca compartas el link del repo con el token incluido; el token vive solo en Netlify (Environment
  variables) y en tu `.env` local, ambos fuera de git.
- Si el token se filtra alguna vez, revócalo en https://airtable.com/create/tokens y crea uno nuevo.
- Como es una app de un solo usuario sin login, cualquiera con la URL de Netlify puede ver y modificar tus
  tareas. Si quieres restringir acceso, la forma más simple es activar **Netlify Identity** o una
  contraseña de sitio (Site settings → Visitor access) — no forma parte de este build inicial pero se puede
  agregar después.
