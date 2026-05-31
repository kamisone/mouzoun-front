import s from './Offerings.module.css'

type OfferingItem = { id: string; title: string; desc: string }
type OfferingsDict = { title: string; subtitle: string; items: OfferingItem[] }

const icons: Record<string, React.ReactNode> = {
  honey: (
    <svg viewBox="0 0 64 64" fill="none" width="40" height="40">
      <path d="M32 4L54 17V43L32 56L10 43V17L32 4Z" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.08"/>
      <path d="M32 22C32 22 26 29 26 33.5C26 36.5 28.7 39 32 39C35.3 39 38 36.5 38 33.5C38 29 32 22 32 22Z" fill="currentColor"/>
    </svg>
  ),
  agriculture: (
    <svg viewBox="0 0 64 64" fill="none" width="40" height="40">
      <path d="M32 56V28" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M32 28C32 28 18 18 18 8C25 8 32 14 32 28Z" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.12"/>
      <path d="M32 36C32 36 46 26 46 16C39 16 32 22 32 36Z" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.12"/>
      <path d="M20 56H44" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  camping: (
    <svg viewBox="0 0 64 64" fill="none" width="40" height="40">
      <path d="M6 50L32 10L58 50H6Z" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.08"/>
      <path d="M18 50L32 26L46 50" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.15"/>
      <path d="M6 50H58" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="49" cy="16" r="5" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.2"/>
      <path d="M49 5V9M60 16H56M53.5 9.5L50.8 12.2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  ),
  cattle: (
    <svg viewBox="0 0 64 64" fill="none" width="40" height="40">
      <ellipse cx="32" cy="36" rx="18" ry="12" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.08"/>
      <path d="M14 36V42C14 49 22 54 32 54C42 54 50 49 50 42V36" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M18 22C18 22 12 16 12 10H18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M46 22C46 22 52 16 52 10H46" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <ellipse cx="32" cy="24" rx="10" ry="8" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.12"/>
    </svg>
  ),
  tourism: (
    <svg viewBox="0 0 64 64" fill="none" width="40" height="40">
      <path d="M32 8C32 8 12 28 12 38C12 49 21 56 32 56C43 56 52 49 52 38C52 28 32 8 32 8Z" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.08"/>
      <circle cx="32" cy="36" r="8" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.15"/>
      <path d="M32 30L34 35H39L35 38.5L37 44L32 40.5L27 44L29 38.5L25 35H30L32 30Z" fill="currentColor" fillOpacity="0.8"/>
    </svg>
  ),
}

export default function Offerings({ dict }: { dict: OfferingsDict }) {
  return (
    <section id="offerings" className={s.section}>
      <div className={s.inner}>
        <div className={s.header}>
          <p className={s.eyebrow}>— Mouzoun —</p>
          <h2 className={s.title}>{dict.title}</h2>
          <p className={s.subtitle}>{dict.subtitle}</p>
        </div>

        <div className={s.grid}>
          {dict.items.map((item, i) => (
            <article key={item.id} className={s.card}>
              <div className={s.icon}>{icons[item.id]}</div>
              <p className={s.cardNum}>{String(i + 1).padStart(2, '0')}</p>
              <div className={s.cardText}>
                <h3 className={s.cardTitle}>{item.title}</h3>
                <p className={s.cardDesc}>{item.desc}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
