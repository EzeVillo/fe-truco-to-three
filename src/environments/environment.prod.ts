const backendUrl = 'https://truco-api.ezevillodev.workers.dev';

export const environment = {
  production: true,
  apiUrl: `${backendUrl}/api`,
  wsUrl: `${backendUrl}/ws`,
  // Endpoint de wake propio del backend: responde 200 en cuanto el proceso acepta
  // requests (despierta el cold-start de Render). Contrato estable, desacoplado de Actuator.
  healthUrl: `${backendUrl}/api/public/wake`,
};
