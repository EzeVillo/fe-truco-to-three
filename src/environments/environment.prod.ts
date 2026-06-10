const backendUrl = 'https://api-truco-to-three.onrender.com';

export const environment = {
  production: true,
  apiUrl: `${backendUrl}/api`,
  wsUrl: `${backendUrl}/ws`,
  // Readiness probe del backend: incluye el check `db`, así que despierta tanto
  // el proceso (Render free tier) como Neon.
  healthUrl: `${backendUrl}/actuator/health/readiness`,
};
