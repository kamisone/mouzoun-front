import s from './Hero.module.css'

type HeroDict = {
  tagline: string
  subtitle: string
  cta_primary: string
  cta_secondary: string
}

function StarSvg({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="currentColor" aria-hidden>
      <polygon points="50,5 61,35 95,35 68,57 79,91 50,70 21,91 32,57 5,35 39,35" />
    </svg>
  )
}

export default function Hero({ dict }: { dict: HeroDict }) {
  return (
    <section className={s.section}>
      <div className={s.bg} />
      <div className={s.pattern} />
      <div className={s.glow} />

      {/* Watermark stars */}
      <div className={s.wm1}><StarSvg size={400} /></div>
      <div className={s.wm2}><StarSvg size={360} /></div>

      {/* Dune silhouette */}
      <svg className={s.dune} viewBox="0 0 1440 160" preserveAspectRatio="none" aria-hidden>
        <path
          d="M0,160 L0,120 C120,80 200,60 320,75 C440,90 520,130 640,125 C760,120 840,75 960,70 C1080,65 1160,90 1280,100 C1360,108 1400,120 1440,115 L1440,160 Z"
          fill="rgba(0,50,73,0.08)"
        />
        <path
          d="M0,160 L0,140 C100,110 200,95 340,105 C480,115 560,145 680,140 C800,135 880,105 1000,100 C1120,95 1220,115 1340,125 C1390,130 1420,140 1440,135 L1440,160 Z"
          fill="rgba(204,219,220,0.97)"
        />
      </svg>

      <div className={s.fade} />

      <div className={s.content}>
        <div className={s.eyebrow}>
          <span className={s.eyebrowLine} />
          <span className={s.eyebrowText}>Coopérative · Maroc · Est. 2022</span>
          <span className={s.eyebrowLine} />
        </div>

        <h1 className={s.title}>Mouzoun</h1>

        <div className={s.rule}>
          <span className={s.ruleLine} />
          <span className={s.ruleStar}><StarSvg size={12} /></span>
          <span className={s.ruleLine} />
        </div>

        <p className={s.tagline}>{dict.tagline}</p>
        <p className={s.subtitle}>{dict.subtitle}</p>

        <div className={s.ctas}>
          <a href="#offerings" className={s.ctaPrimary}>{dict.cta_primary}</a>
          <a href="#location"  className={s.ctaSecondary}>{dict.cta_secondary}</a>
        </div>
      </div>

      <div className={s.scroll}>
        <div className={s.scrollLine} />
        <div className={s.scrollDot} />
      </div>
    </section>
  )
}
