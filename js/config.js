// Configuración no sensible del frontend.
// El token de Airtable NUNCA vive aquí: se inyecta server-side en la función de Netlify.
const CONFIG = {
  API_ENDPOINT: '/.netlify/functions/airtable',
  BUSINESSES: ['Vaxta Padel', 'BIKLA', 'InteligIA', 'KW Sinergia', 'Personal'],
  STATUSES: ['Por hacer', 'En progreso', 'Completada'],
  PRIORITIES: ['Alta', 'Media', 'Baja'],
};
