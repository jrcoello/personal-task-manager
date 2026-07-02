// Capa de acceso a datos: habla con la función serverless de Netlify,
// nunca directamente con Airtable (así el token nunca llega al navegador).

async function airtableRequest(method, { id, params, fields } = {}) {
  const url = new URL(CONFIG.API_ENDPOINT, window.location.origin);
  if (id) url.searchParams.set('id', id);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, v);
    }
  }

  const opts = { method };
  if (fields) {
    opts.headers = { 'Content-Type': 'application/json' };
    opts.body = JSON.stringify({ fields, typecast: true });
  }

  const res = await fetch(url.toString(), opts);
  if (!res.ok) {
    let detail = '';
    try { detail = JSON.stringify(await res.json()); } catch (_) {}
    throw new Error(`Airtable request failed (${res.status}): ${detail}`);
  }
  if (method === 'DELETE') return res.json();
  return res.json();
}

async function listTasks() {
  let all = [];
  let offset;
  do {
    const params = { pageSize: 100 };
    if (offset) params.offset = offset;
    const data = await airtableRequest('GET', { params });
    all = all.concat(data.records || []);
    offset = data.offset;
  } while (offset);
  return all;
}

function createTask(fields) {
  return airtableRequest('POST', { fields });
}

function updateTask(id, fields) {
  return airtableRequest('PATCH', { id, fields });
}

function deleteTask(id) {
  return airtableRequest('DELETE', { id });
}

async function fetchSchemaOptions() {
  const res = await fetch('/.netlify/functions/schema');
  if (!res.ok) throw new Error(`Schema request failed (${res.status})`);
  return res.json();
}
