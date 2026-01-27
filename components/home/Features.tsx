import { Sparkles, Clock, Heart, Package } from "lucide-react";

const features = [
  {
    icon: Sparkles,
    title: "AI-Powered Design",
    description:
      "Our AI analyzes your photos, selects the best moments, and builds a beautiful layout automatically.",
  },
  {
    icon: Clock,
    title: "Ready in Minutes",
    description:
      "Upload your photos and receive a complete photo book design in under 5 minutes.",
  },
  {
    icon: Heart,
    title: "Your Story, Your Way",
    description:
      "Edit, rearrange and personalize every page until your story feels perfect.",
  },
  {
    icon: Package,
    title: "Premium Quality",
    description:
      "Museum-quality printing on thick, luxurious paper, delivered to your door.",
  },
];

export default function Features() {
  return (
    <section className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6 text-center">
        <h2 className="text-4xl md:text-5xl font-bold text-gray-900 tracking-tight">
          Creating memories has never been easier
        </h2>
        <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">
          Pixia doesn&apos;t just organize photos. Pixia creates your story.
        </p>

        <div className="mt-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg transition-all duration-300 p-8"
            >
              <div className="flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-orange-100 to-pink-100 mx-auto mb-6">
                <feature.icon className="w-6 h-6 text-orange-500" />
              </div>

              <h3 className="text-lg font-semibold text-gray-900 tracking-tight mb-2">
                {feature.title}
              </h3>

              <p className="text-gray-600 text-sm leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

