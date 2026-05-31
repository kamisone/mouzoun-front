import Image from 'next/image'
import s from './Footer.module.css'

type FooterDict = {
  tagline: string
  rights: string
  links: { privacy: string; legal: string }
}

function StarIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="currentColor" aria-hidden>
      <polygon points="50,5 61,35 95,35 68,57 79,91 50,70 21,91 32,57 5,35 39,35" />
    </svg>
  )
}

export default function Footer({ dict }: { dict: FooterDict; lang: string }) {
  const year = new Date().getFullYear()

  return (
    <footer className={s.footer}>
      <div className={`${s.wm} ${s.wm1}`}><StarIcon size={160} /></div>
      <div className={`${s.wm} ${s.wm2}`}><StarIcon size={160} /></div>

      <div className={s.inner}>
        <div className={s.brand}>
          <Image
            src="/assets/mouzoun-logo.png"
            alt="Mouzoun"
            width={36}
            height={36}
            className={s.logoImg}
          />
          <div>
            <p className={s.brandName}>Mouzoun</p>
            <p className={s.brandTagline}>{dict.tagline}</p>
          </div>
        </div>

        <div className={s.meta}>
          <a href="#" className={s.metaLink}>{dict.links.privacy}</a>
          <span className={s.dot}>·</span>
          <a href="#" className={s.metaLink}>{dict.links.legal}</a>
          <span className={s.dot}>·</span>
          <span>© {year} Mouzoun. {dict.rights}</span>
        </div>
      </div>
    </footer>
  )
}
