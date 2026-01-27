"use client";

import Reveal from "@/components/ui/Reveal";

const testimonials = [
  {
    name: "Laura & Andrés",
    tag: "Boda",
    image: "/testimonials/couple1.jpg",
    text: "Pixia transformó las fotos de nuestra boda en un libro que parece una película. Cada página cuenta nuestra historia con una calidad impresionante.",
  },
  {
    name: "Camila R.",
    tag: "Viaje",
    image: "/testimonials/couple2.jpg",
    text: "Revivir nuestro viaje por Europa a través de un álbum de Pixia fue emocionante. El diseño, los colores y la narrativa visual son simplemente perfectos.",
  },
  {
    name: "Daniel & Sofía",
    tag: "Aniversario",
    image: "/testimonials/couple3.jpg",
    text: "Regalamos un libro de Pixia a nuestros padres por su aniversario y fue un momento inolvidable. Un recuerdo que quedará para siempre.",
  },
];

export default function Testimonials() {
  return (
    <section className="py-24 bg-gradient-to-b from-[#FFF1ED] to-white" id="stories">
      <div className="max-w-6xl mx-auto px-6 text-center">
        <Reveal>
          <h2 className="text-4xl font-bold text-gray-900">
            Historias que viven para siempre
          </h2>
        </Reveal>

        <Reveal delay={0.1}>
          <p className="mt-3 text-gray-600">
            Recuerdos reales, cuidadosamente transformados en libros por Pixia.
          </p>
        </Reveal>

        <div className="mt-14 grid md:grid-cols-3 gap-8">
          {testimonials.map((t, i) => (
            <Reveal key={i} delay={0.2 + i * 0.15}>
              <div className="bg-white rounded-2xl p-8 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                <div className="flex text-gray-400 mb-3 tracking-wide">★★★★★</div>

                <p className="italic text-gray-700 leading-relaxed">
                  “{t.text}”
                </p>

                <div className="flex items-center gap-4 mt-6">
                  <img
                    src={t.image}
                    alt={t.name}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                  <div className="text-left">
                    <p className="font-semibold text-gray-900">{t.name}</p>
                    <p className="text-sm text-gray-500">{t.tag}</p>
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        {/* CTA FINAL */}
        <Reveal delay={0.8}>
          <div className="mt-20">
            <p className="text-lg text-gray-700 mb-6">
              Tú también puedes convertir tus recuerdos en un libro para siempre.
            </p>

            <button className="px-10 py-4 rounded-full text-white font-semibold bg-gradient-to-r from-[#FF7A59] via-[#FF5F8A] to-[#FF3CAC] shadow-xl hover:scale-105 transition-transform">
              Crear mi álbum
            </button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}



