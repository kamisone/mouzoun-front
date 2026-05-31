import { notFound } from 'next/navigation'
import { hasLocale } from './dictionaries'

export async function generateStaticParams() {
  return [{ lang: 'fr' }, { lang: 'en' }]
}

/* No html/body here — the root layout owns the document shell.
   This layout just validates the locale and renders children. */
export default async function LangLayout({
  children,
  params,
}: LayoutProps<'/[lang]'>) {
  const { lang } = await params
  if (!hasLocale(lang)) notFound()

  return <>{children}</>
}
