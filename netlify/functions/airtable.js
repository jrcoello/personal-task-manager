// Proxy serverless: el único lugar donde el token de Airtable existe.
// Se lee de la variable de entorno AIRTABLE_TOKEN (configurada en Netlify, nunca en el repo).

const BASE_ID = process.env.AIRTABLE_BASE_ID || 'apps6HOqFYkoY4AGu';
const TABLE_ID = process.env.AIRTABLE_TABLE_ID || 'tblH0j0Lj9vN7oD53';
const TOKEN = process.env.AIRTABLE_TOKEN;

const ALLOWED_METHODS = ['GET', 'POST', 'PATCH', 'DELETE'];

exports.handler = async (event) => {
  if (!TOKEN) {
    return json(500, { error: 'AIRTABLE_TOKEN no está configurado en el entorno de Netlify.' });
  }

  const method = event.httpMethod;
  if (!ALLOWED_METHODS.includes(method)) {
    return json(405, { error: `Método no permitido: ${method}` });
  }

  const qs = event.queryStringParameters || {};
  const recordId = qs.id;

  let url = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`;
  if (recordId) url += `/${encodeURIComponent(recordId)}`;

  if (method === 'GET') {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(qs)) {
      if (key !== 'id') params.append(key, value);
    }
    const queryString = params.toString();
    if (queryString) url += `?${queryString}`;
  }

  if ((method === 'PATCH' || method === 'DELETE') && !recordId) {
    return json(400, { error: 'Falta el parámetro "id" para esta operación.' });
  }

  const fetchOptions = {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
  };

  if ((method === 'POST' || method === 'PATCH') && event.body) {
    fetchOptions.body = event.body;
  }

  try {
    const response = await fetch(url, fetchOptions);
    const data = await response.text();
    return {
      statusCode: response.status,
      headers: { 'Content-Type': 'application/json' },
      body: data,
    };
  } catch (err) {
    return json(502, { error: 'Error contactando a Airtable', detail: err.message });
  }
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}
