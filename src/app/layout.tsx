import './globals.css'
import { Cormorant_Garamond, Jost } from 'next/font/google'
import { headers } from 'next/headers'

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-cormorant',
  display: 'swap',
})

const jost = Jost({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-jost',
  display: 'swap',
})

/* Derive lang from the URL pathname so <html lang="..."> is always correct */
async function getLangFromPath(): Promise<string> {
  const h = await headers()
  const url = h.get('x-forwarded-url') ?? h.get('referer') ?? ''
  const pathname = h.get('x-invoke-path') ?? h.get('next-url') ?? url
  if (pathname.startsWith('/en')) return 'en'
  return 'fr'
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const lang = await getLangFromPath()

  return (
    <html
      lang={lang}
      className={`${cormorant.variable} ${jost.variable}`}
    >
      <body className="font-sans antialiased bg-night text-sand-dim">
        {children}
      </body>
    </html>
  )
}
