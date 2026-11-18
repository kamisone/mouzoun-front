/**
 * Social networks the camp is on, in display order. The URLs live in app.config (site.social);
 * here: the brand name, the official logo (Simple Icons) and how to read the handle from the URL.
 */
export const SOCIAL_NETWORKS = [
  { key: 'instagram', name: 'Instagram', icon: 'i-simple-icons-instagram' },
  { key: 'tiktok', name: 'TikTok', icon: 'i-simple-icons-tiktok' },
  { key: 'youtube', name: 'YouTube', icon: 'i-simple-icons-youtube' },
  { key: 'facebook', name: 'Facebook', icon: 'i-simple-icons-facebook' },
] as const

export type SocialKey = typeof SOCIAL_NETWORKS[number]['key']

export interface SocialLink {
  key: SocialKey
  name: string
  icon: string
  url: string
  /** "@mouzoun_mssici", or null when the URL has no readable handle (Facebook profile ids). */
  handle: string | null
}

/** "@name" from the profile URL path, when it is a plain handle. */
export function socialHandle(url: string): string | null {
  try {
    const segment = new URL(url).pathname.split('/').find(Boolean)
    if (!segment || segment.endsWith('.php')) return null
    return segment.startsWith('@') ? segment : `@${segment}`
  }
  catch {
    return null
  }
}

/** The configured networks, in display order, skipping the empty ones. */
export function socialLinks(urls: Partial<Record<SocialKey, string>>): SocialLink[] {
  return SOCIAL_NETWORKS.flatMap(n => (urls[n.key] ? [{ ...n, url: urls[n.key]!, handle: socialHandle(urls[n.key]!) }] : []))
}
