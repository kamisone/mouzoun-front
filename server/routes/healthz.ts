// Liveness probe used by the deploy health gate (no SSR, no API call).
export default defineEventHandler(() => ({ status: 'ok' }))
