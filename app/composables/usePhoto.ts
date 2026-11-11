import photos from '~/data/photos.json'

/**
 * Photos prepared by scripts/grade-photos.mjs (warm grade, 2000 px, blur-up preview, credit).
 * Alt texts are translated: `photos.<slug>` in i18n/locales.
 */
export interface Photo {
  slug: string
  src: string
  /** Pre-generated WebP variants ("… 480w, … 800w, …"). */
  srcset: string
  width: number
  height: number
  lqip: string
  alt: string
  credit: { author: string, license: string, licenseUrl: string, sourcePage: string, title: string, place: string }
}

export type PhotoSlug = (typeof photos)[number]['slug']

export function usePhoto() {
  const { t } = useI18n()
  function photo(slug: PhotoSlug): Photo {
    const p = photos.find(x => x.slug === slug)
    if (!p) throw new Error(`unknown photo ${slug}`)
    return {
      slug: p.slug,
      src: p.src,
      srcset: p.srcset,
      width: p.width,
      height: p.height,
      lqip: p.lqip,
      alt: t(`photos.${p.slug}`),
      credit: { author: p.author, license: p.license, licenseUrl: p.licenseUrl, sourcePage: p.sourcePage, title: p.title, place: p.place },
    }
  }
  return { photo, all: () => photos.map(p => photo(p.slug as PhotoSlug)) }
}
