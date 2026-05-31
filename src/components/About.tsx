import s from './About.module.css'

type AboutDict = {
  badge: string
  title: string
  body: string
  values: { title: string; desc: string }[]
}

function StarSvg({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="currentColor" aria-hidden>
      <polygon points="50,5 61,35 95,35 68,57 79,91 50,70 21,91 32,57 5,35 39,35" />
    </svg>
  )
}

function Divider({ className }: { className?: string }) {
  return (
    <div className={`${s.divider} ${className ?? ''}`}>
      <span className={s.dividerLine} />
      <span className={s.dividerStar}><StarSvg size={14} /></span>
      <span className={s.dividerLine} />
    </div>
  )
}

export default function About({ dict }: { dict: AboutDict }) {
  return (
    <section id="about" className={s.section}>
      <div className={s.inner}>
        <Divider />

        <div className={s.grid}>
          <div>
            <p className={s.badge}>{dict.badge}</p>
            <h2 className={s.title}>{dict.title}</h2>
            <p className={s.body}>{dict.body}</p>
          </div>

          <div className={s.values}>
            {dict.values.map((v, i) => (
              <div key={i} className={s.value}>
                <span className={s.num}>{String(i + 1).padStart(2, '0')}</span>
                <div>
                  <p className={s.valueTitle}>{v.title}</p>
                  <p className={s.valueDesc}>{v.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <Divider className={s.dividerBottom} />
      </div>
    </section>
  )
}
