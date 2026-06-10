export const environment = {
  production: false,
  apiUrl: '/api',
  wsUrl: '/ws',
  // Readiness probe del backend: incluye el check `db`, así que despierta tanto
  // el proceso (Render free tier) como Neon. Se proxea vía proxy.conf.json.
  healthUrl: '/actuator/health/readiness',
};
