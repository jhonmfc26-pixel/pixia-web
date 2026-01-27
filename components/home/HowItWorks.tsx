import { Upload, Wand2, Eye, Package } from "lucide-react";
import Reveal from "@/components/ui/Reveal";

const steps = [
  {
    number: "01",
    title: "Upload Your Photos",
    description: "Select 50–300 photos from your phone, computer, or cloud storage.",
    icon: Upload,
  },
  {
    number: "02",
    title: "AI Creates Your Book",
    description: "Our AI organizes, curates, and designs your perfect photo book.",
    icon: Wand2,
  },
  {
    number: "03",
    title: "Review & Customize",
    description: "Preview your book and make any changes you want before printing.",
    icon: Eye,
  },
  {
    number: "04",
    title: "Receive Your Book",
    description: "Premium printed book delivered in beautiful packaging to your door.",
    icon: Package,
  },
];

export default function HowItWorks() {
  return (
    <section className="bg-white py-24" id="how">
      <div className="mx-auto max-w-7xl px-6 text-center">
        <Reveal>
          <h2 className="text-4xl font-bold text-gray-900">How it works</h2>
        </Reveal>

        <Reveal delay={0.1}>
          <p className="mt-4 text-lg text-gray-600">
            From photos to a printed book in four simple steps
          </p>
        </Reveal>

        <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <Reveal key={step.number} delay={0.2 + index * 0.15}>
                <div className="relative rounded-2xl border border-gray-100 bg-white p-8 shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
                  {/* Número de fondo */}
                  <span className="absolute top-4 right-6 text-6xl font-extrabold text-gray-300 opacity-50 select-none">
                    {step.number}
                  </span>

                  {/* Icono */}
                  <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 text-orange-500">
                    <Icon size={24} />
                  </div>

                  {/* Texto */}
                  <h3 className="mb-2 text-lg font-semibold text-gray-900">
                    {step.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-gray-600">
                    {step.description}
                  </p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

