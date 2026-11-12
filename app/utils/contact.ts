/** Countries (ISO 3166-1 alpha-2), dial codes and email typo suggestions for the checkout form. */

const CODES = 'AD AE AF AG AL AM AO AR AT AU AZ BA BB BD BE BF BG BH BI BJ BN BO BR BS BT BW BY BZ CA CD CF CG CH CI CL CM CN CO CR CU CV CY CZ DE DJ DK DM DO DZ EC EE EG ER ES ET FI FJ FR GA GB GD GE GH GM GN GQ GR GT GW GY HK HN HR HT HU ID IE IL IN IQ IR IS IT JM JO JP KE KG KH KM KN KR KW KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MG MK ML MM MN MR MT MU MV MW MX MY MZ NA NE NG NI NL NO NP NZ OM PA PE PG PH PK PL PS PT PY QA RO RS RU RW SA SB SC SD SE SG SI SK SL SM SN SO SR SS ST SV SY SZ TD TG TH TJ TL TM TN TO TR TT TW TZ UA UG US UY UZ VC VE VN VU WS YE ZA ZM ZW'.split(' ')

/** Dial codes of the countries most guests come from (others type the full number). */
export const DIAL_CODES: Record<string, string> = {
  MA: '+212', FR: '+33', ES: '+34', DE: '+49', GB: '+44', IT: '+39', BE: '+32', NL: '+31', CH: '+41', PT: '+351',
  US: '+1', CA: '+1', DZ: '+213', TN: '+216', AE: '+971', SA: '+966', IE: '+353', AT: '+43', SE: '+46', NO: '+47',
  DK: '+45', PL: '+48', CZ: '+420', AU: '+61', JP: '+81', CN: '+86', BR: '+55', MX: '+52',
}

export function countries(locale: string): { value: string, label: string }[] {
  let names: Intl.DisplayNames | null = null
  try {
    names = new Intl.DisplayNames([locale], { type: 'region' })
  }
  catch { /* old engines: codes only */ }
  return CODES.map(code => ({ value: code, label: names?.of(code) ?? code }))
    .sort((a, b) => a.label.localeCompare(b.label, locale))
}

/** The guest's likely country from the page language (prefill only). */
export function defaultCountry(locale: string): string {
  return ({ ar: 'MA', fr: 'FR', en: 'GB' } as Record<string, string>)[locale] ?? 'MA'
}

const DOMAINS = ['gmail.com', 'hotmail.com', 'hotmail.fr', 'outlook.com', 'outlook.fr', 'yahoo.com', 'yahoo.fr', 'icloud.com', 'live.com', 'live.fr', 'orange.fr', 'free.fr', 'sfr.fr', 'laposte.net', 'wanadoo.fr', 'gmx.de', 'web.de', 'menara.ma', 'protonmail.com']

function distance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)] as number[])
  for (let j = 1; j <= b.length; j++) d[0]![j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i]![j] = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
  }
  return d[a.length]![b.length]!
}

/** `amina@gmial.com` → `amina@gmail.com` (one or two typos away from a common domain). */
export function suggestEmail(email: string): string | null {
  const [local, domain] = email.trim().toLowerCase().split('@')
  if (!local || !domain || DOMAINS.includes(domain)) return null
  const best = DOMAINS.map(d => ({ d, n: distance(domain, d) })).sort((a, b) => a.n - b.n)[0]
  return best && best.n > 0 && best.n <= 2 ? `${local}@${best.d}` : null
}

export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim())
}
