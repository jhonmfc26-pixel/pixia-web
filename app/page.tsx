import Hero from "@/components/home/Hero";
import HowItWorks from "@/components/home/HowItWorks";
import ExampleAlbums from "@/components/home/ExampleAlbums";
import Features from "@/components/home/Features";
import Pricing from "@/components/home/Pricing";
import CTA from "@/components/home/CTA";
import Footer from "@/components/home/Footer";
import Header from '@/components/home/Header'

export default function Home() {
  return (
    <>
      <Header />
      <Hero />
      <ExampleAlbums />
      <HowItWorks />
      <Features />
      <Pricing />
      <CTA />
      <Footer />
    </>
  )
}
