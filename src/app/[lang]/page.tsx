import { notFound } from 'next/navigation'
import { getDictionary, hasLocale } from './dictionaries'
import Navbar from '@/components/Navbar'
import Hero from '@/components/Hero'
import About from '@/components/About'
import Offerings from '@/components/Offerings'
import Location from '@/components/Location'
import Contact from '@/components/Contact'
import Footer from '@/components/Footer'

export default async function HomePage({ params }: PageProps<'/[lang]'>) {
  const { lang } = await params
  if (!hasLocale(lang)) notFound()

  const dict = await getDictionary(lang)

  return (
    <>
      <Navbar dict={{ nav: dict.nav }} lang={lang} />
      <main>
        <Hero dict={dict.hero} />
        <About dict={dict.about} />
        <Offerings dict={dict.offerings} />
        <Location dict={dict.location} />
        <Contact dict={dict.contact} />
      </main>
      <Footer dict={dict.footer} lang={lang} />
    </>
  )
}
