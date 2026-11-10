/**
 * Base URL of the Rust API: internal Docker URL during SSR, public URL in the browser.
 * Usage: useFetch<T>('/v1/...', { baseURL: useApiBase() })
 */
export function useApiBase() {
  const config = useRuntimeConfig()
  return import.meta.server ? config.apiInternalBase : config.public.apiBase
}
