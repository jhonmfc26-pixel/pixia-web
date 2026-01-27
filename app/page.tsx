import Hero from "@/components/home/Hero";
import Features from "@/components/home/Features";
import HowItWorks from "@/components/home/HowItWorks";
import Testimonials from "@/components/home/Testimonials";
import CTA from "@/components/home/CTA";
import Footer from "@/components/home/Footer";
import Header from '@/components/home/Header'


export default function Home() {
  return (
    <>
      <Header />
      <Hero />
      <Features />
      <HowItWorks />
      <Testimonials />
      <CTA />
      <Footer />
    </>
  )
}
