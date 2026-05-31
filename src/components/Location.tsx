import s from './Location.module.css'

type LocationDict = {
  title: string
  subtitle: string
  region: string
  gps: string
  directions: string
}

const LAT = 31.238933
const LON = -4.701349

export default function Location({ dict }: { dict: LocationDict }) {
  const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${LON - 0.06},${LAT - 0.06},${LON + 0.06},${LAT + 0.06}&layer=mapnik&marker=${LAT},${LON}`

  return (
    <section id="location" className={s.section}>
      <div className={s.inner}>
        <div className={s.header}>
          <p className={s.coords}>31°14′N · 4°42′O</p>
          <h2 className={s.title}>{dict.title}</h2>
          <p className={s.subtitle}>{dict.subtitle}</p>
        </div>

        <div className={s.layout}>
          <div className={s.mapWrap}>
            <iframe
              src={mapUrl}
              className={s.map}
              allowFullScreen
              loading="lazy"
              title="Mouzoun location"
            />
            <div className={s.mapOverlay} />
          </div>

          <div className={s.panel}>
            <div className={s.detail}>
              <span className={s.detailIcon}><PinIcon /></span>
              <div>
                <p className={s.detailLabel}>{dict.region}</p>
                <p className={s.detailSub}>{dict.gps}</p>
              </div>
            </div>
            <div className={s.detail}>
              <span className={s.detailIcon}><RouteIcon /></span>
              <div>
                <p className={s.detailLabel}>{dict.directions}</p>
              </div>
            </div>
            <div className={s.panelAction}>
              <a
                href={`https://www.openstreetmap.org/?mlat=${LAT}&mlon=${LON}#map=13/${LAT}/${LON}`}
                target="_blank"
                rel="noopener noreferrer"
                className={s.mapLink}
              >
                <ExternalIcon />
                Open in maps
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function PinIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
      <circle cx="12" cy="10" r="3"/>
    </svg>
  )
}

function RouteIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="6" cy="19" r="3"/>
      <path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/>
      <circle cx="18" cy="5" r="3"/>
    </svg>
  )
}

function ExternalIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
      <polyline points="15 3 21 3 21 9"/>
      <line x1="10" y1="14" x2="21" y2="3"/>
    </svg>
  )
}
