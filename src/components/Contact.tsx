import s from './Contact.module.css'

type ContactDict = {
  title: string
  subtitle: string
  email_label: string
  phone_label: string
  email: string
  phone: string
  cta: string
}

function StarWm() {
  return (
    <svg width="600" height="600" viewBox="0 0 100 100" fill="currentColor" aria-hidden>
      <polygon points="50,5 61,35 95,35 68,57 79,91 50,70 21,91 32,57 5,35 39,35" />
    </svg>
  )
}

export default function Contact({ dict }: { dict: ContactDict }) {
  return (
    <section id="contact" className={s.section}>
      <div className={s.wm}><StarWm /></div>

      <div className={s.inner}>
        <p className={s.eyebrow}>— Contact —</p>
        <h2 className={s.title}>{dict.title}</h2>
        <p className={s.subtitle}>{dict.subtitle}</p>

        <div className={s.cards}>
          <a href={`mailto:${dict.email}`} className={s.card}>
            <div className={s.cardIcon}><EmailIcon /></div>
            <span className={s.cardLabel}>{dict.email_label}</span>
            <span className={s.cardValue}>{dict.email}</span>
          </a>
          <a href={`tel:${dict.phone.replace(/\s/g, '')}`} className={s.card}>
            <div className={s.cardIcon}><PhoneIcon /></div>
            <span className={s.cardLabel}>{dict.phone_label}</span>
            <span className={s.cardValue}>{dict.phone}</span>
          </a>
        </div>

        <a href={`mailto:${dict.email}`} className={s.cta}>{dict.cta}</a>
      </div>
    </section>
  )
}

function EmailIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
      <polyline points="22,6 12,13 2,6"/>
    </svg>
  )
}

function PhoneIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13.1a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2.22h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.16 6.16l.91-.91a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
    </svg>
  )
}
