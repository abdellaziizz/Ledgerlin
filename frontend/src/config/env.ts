/** Centralised runtime configuration. Only VITE_-prefixed values reach the browser; never put secrets here. */
export const env = {
  apiBaseUrl: (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") || "/api/v1",
} as const;
