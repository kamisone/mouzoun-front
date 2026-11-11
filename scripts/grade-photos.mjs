// Prepares photos for the site with one consistent warm grade:
//   node scripts/grade-photos.mjs <manifest.json>
// The manifest lists { slug, source (local path), credit... }. For each photo: slightly lower
// saturation, warm shift (a touch more red, less blue), then
//   - responsive WebP variants (480 → 2000 px) for srcset: served as static files, no image
//     processing at request time (on-the-fly resizing failed under load);
//   - a 2000 px progressive JPEG fallback;
//   - a 20 px blurred preview (blur-up placeholder),
// recorded with the credits in app/data/photos.json.
import { readFileSync, writeFileSync } from 'node:fs'
import sharp from 'sharp'

const manifest = JSON.parse(readFileSync(process.argv[2], 'utf8'))
const WARM = [
  [1.04, 0.02, 0],
  [0.01, 1.0, 0],
  [0, 0.02, 0.92],
]
const WIDTHS = [480, 800, 1200, 1600, 2000]
const out = []
for (const photo of manifest) {
  const graded = sharp(photo.source).rotate().resize({ width: 2000, withoutEnlargement: true })
    .modulate({ saturation: 0.88, brightness: 1.01 })
    .recomb(WARM)
  const info = await graded.clone().jpeg({ quality: 78, progressive: true, mozjpeg: true })
    .toFile(`public/images/photos/${photo.slug}.jpg`)
  const srcset = []
  for (const width of WIDTHS.filter(w => w <= info.width)) {
    await graded.clone().resize({ width }).webp({ quality: 74 }).toFile(`public/images/photos/${photo.slug}-${width}.webp`)
    srcset.push(`/images/photos/${photo.slug}-${width}.webp ${width}w`)
  }
  const preview = await graded.clone().resize(20).blur(1.2).jpeg({ quality: 50 }).toBuffer()
  const meta = { ...photo }
  delete meta.source
  out.push({ ...meta, src: `/images/photos/${photo.slug}.jpg`, srcset: srcset.join(', '), width: info.width, height: info.height, lqip: `data:image/jpeg;base64,${preview.toString('base64')}` })
  console.log(`${photo.slug}: ${info.width}×${info.height}, ${Math.round(info.size / 1024)} KB`)
}
writeFileSync('app/data/photos.json', `${JSON.stringify(out, null, 2)}\n`)
