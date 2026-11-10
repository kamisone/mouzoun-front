import type { Activity } from '~/utils/types'

export function useActivities() {
  return useFetch<Activity[]>('/v1/activities', {
    baseURL: useApiBase(),
    key: 'activities',
    default: () => [],
  })
}

export function useActivity(slug: string) {
  return useFetch<Activity>(`/v1/activities/${encodeURIComponent(slug)}`, {
    baseURL: useApiBase(),
    key: `activity-${slug}`,
  })
}
