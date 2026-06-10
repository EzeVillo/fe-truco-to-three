export const environment = {
  production: false,
  apiUrl: '/api',
  wsUrl: '/ws',
  // Endpoint de wake propio del backend: responde 200 en cuanto el proceso acepta
  // requests (despierta el cold-start de Render). Se proxea vía proxy.conf.json.
  healthUrl: '/api/public/wake',
};
