"use client";

import { motion } from "framer-motion";

const testimonials = [
  {
    name: "Laura & Andrés",
    tag: "Boda",
    image: "/testimonials/couple1.jpg",
    text: "Pixia transformó las fotos de nuestra boda en un libro que parece una película. Cada página cuenta nuestra historia con una calidad impresionante."
  },
  {
    name: "Camila R.",
    tag: "Viaje",
    image: "/testimonials/couple2.jpg",
    text: "Revivir nuestro viaje por Europa a través de un álbum de Pixia fue emocionante. El diseño, los colores y la narrativa visual son simplemente perfectos."
  },
  {
    name: "Daniel & Sofía",
    tag: "Aniversario",
    image: "/testimonials/couple3.jpg",
    text: "Regalamos un libro de Pixia a nuestros padres por su aniversario y fue un momento inolvidable. Un recuerdo que quedará para siempre."
  }
];

export default function Testimonials() {
  return (
    <section className="py-24 bg-gradient-to-b from-[#FFF5F2] to-white">
      <div className="max-w-6xl mx-auto px-6 text-center">
        <h2 className="text-4xl font-bold text-gray-900">
          Historias que viven para siempre
        </h2>
        <p className="mt-3 text-gray-600">
          Recuerdos reales, cuidadosamente transformados en libros por Pixia.
        </p>

        <div className="mt-14 grid md:grid-cols-3 gap-8">
          {testimonials.map((t, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: i * 0.15 }}
              viewport={{ once: true }}
              className="bg-white rounded-2xl p-8 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all"
            >
              <div className="flex text-gray-400 mb-3">★★★★★</div>

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
            </motion.div>
          ))}
        </div>

        <p className="mt-14 text-gray-700">
          Tú también puedes convertir tus recuerdos en un libro para siempre.
        </p>

        <button className="mt-6 px-8 py-4 rounded-full text-white font-semibold bg-gradient-to-r from-[#FF7A59] via-[#FF5F8A] to-[#FF3CAC] shadow-lg hover:scale-105 transition-transform">
          Crear mi álbum
        </button>
      </div>
    </section>
  );
}





