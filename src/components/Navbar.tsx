'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import s from './Navbar.module.css'

type Dict = {
  nav: { about: string; offerings: string; location: string; contact: string }
}

export default function Navbar({ dict, lang }: { dict: Dict; lang: string }) {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const otherLang = lang === 'fr' ? 'en' : 'fr'

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const links = [
    { href: '#about',     label: dict.nav.about },
    { href: '#offerings', label: dict.nav.offerings },
    { href: '#location',  label: dict.nav.location },
    { href: '#contact',   label: dict.nav.contact },
  ]

  return (
    <>
      <header className={`${s.header} ${scrolled ? s.headerScrolled : ''}`}>
        <nav className={s.nav}>
          <Link href={`/${lang}`} className={s.logo}>
            <Image
              src="/assets/mouzoun-logo.png"
              alt="Mouzoun"
              width={40}
              height={40}
              className={s.logoImg}
              priority
            />
            <span className={s.logoText}>Mouzoun</span>
          </Link>

          <ul className={s.links}>
            {links.map((l) => (
              <li key={l.href}>
                <a href={l.href} className={s.link}>{l.label}</a>
              </li>
            ))}
          </ul>

          <div className={s.right}>
            <Link href={`/${otherLang}`} className={s.langBtn}>
              {otherLang === 'fr' ? 'FR' : 'EN'}
            </Link>
            <button
              className={`${s.burger} ${open ? s.open : ''}`}
              onClick={() => setOpen((v) => !v)}
              aria-label="Menu"
            >
              <span className={s.burgerLine} />
              <span className={s.burgerLine} />
              <span className={s.burgerLine} />
            </button>
          </div>
        </nav>
      </header>

      <div className={`${s.overlay} ${open ? s.open : ''}`} aria-hidden={!open}>
        <StarIcon className={s.overlayStar} size={28} />
        {links.map((l) => (
          <a
            key={l.href}
            href={l.href}
            className={s.overlayLink}
            onClick={() => setOpen(false)}
          >
            {l.label}
          </a>
        ))}
      </div>
    </>
  )
}

function StarIcon({ size = 24, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="currentColor" className={className} aria-hidden>
      <polygon points="50,5 61,35 95,35 68,57 79,91 50,70 21,91 32,57 5,35 39,35" />
    </svg>
  )
}
