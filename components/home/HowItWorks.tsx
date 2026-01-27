import { Upload, Wand2, Eye, Package } from "lucide-react";

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
    <section className="bg-white py-24">
      <div className="mx-auto max-w-7xl px-6 text-center">
        <h2 className="text-4xl font-bold text-gray-900">How it works</h2>
        <p className="mt-4 text-lg text-gray-600">
          From photos to a printed book in four simple steps
        </p>

        <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <div
                key={step.number}
                className="relative rounded-2xl border border-gray-100 bg-white p-8 shadow-sm transition hover:shadow-md"
              >
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
            );
          })}
        </div>
      </div>
    </section>
  );
}

