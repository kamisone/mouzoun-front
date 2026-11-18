import { describe, expect, it } from 'vitest'
import { socialHandle, socialLinks } from '../../app/utils/social'

describe('social links', () => {
  it('reads the handle from each profile URL', () => {
    expect(socialHandle('https://www.instagram.com/mouzoun_mssici/')).toBe('@mouzoun_mssici')
    expect(socialHandle('https://www.tiktok.com/@mouzoun.mssici')).toBe('@mouzoun.mssici')
    expect(socialHandle('https://www.youtube.com/@MouzounMssici')).toBe('@MouzounMssici')
    expect(socialHandle('https://www.facebook.com/profile.php?id=61596592589247')).toBeNull()
    expect(socialHandle('not a url')).toBeNull()
  })

  it('keeps the display order and skips empty networks', () => {
    const links = socialLinks({ facebook: 'https://www.facebook.com/x', tiktok: '', instagram: 'https://www.instagram.com/y/' })
    expect(links.map(l => l.key)).toEqual(['instagram', 'facebook'])
    expect(links[0]!.icon).toBe('i-simple-icons-instagram')
  })
})
