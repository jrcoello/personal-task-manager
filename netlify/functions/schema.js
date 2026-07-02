// Lee las opciones actuales de los campos select (Business, Task Status, Priority)
// directo del esquema de Airtable, para que el frontend no dependa de listas
// hardcodeadas que se desincronizan cuando editas los campos en Airtable.
// Requiere que el token tenga el scope schema.bases:read.

const BASE_ID = process.env.AIRTABLE_BASE_ID || 'apps6HOqFYkoY4AGu';
const TABLE_ID = process.env.AIRTABLE_TABLE_ID || 'tblH0j0Lj9vN7oD53';
const TOKEN = process.env.AIRTABLE_TOKEN;

exports.handler = async () => {
  if (!TOKEN) {
    return json(500, { error: 'AIRTABLE_TOKEN no está configurado en el entorno de Netlify.' });
  }

  try {
    const response = await fetch(`https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    const data = await response.json();
    if (!response.ok) return json(response.status, data);

    const table = data.tables.find((t) => t.id === TABLE_ID);
    if (!table) return json(404, { error: 'Tabla no encontrada en el esquema.' });

    const choicesFor = (fieldName) => {
      const field = table.fields.find((f) => f.name === fieldName);
      return (field && field.options && field.options.choices || []).map((c) => c.name);
    };

    return json(200, {
      businesses: choicesFor('Business'),
      statuses: choicesFor('Task Status'),
      priorities: choicesFor('Priority'),
    });
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
