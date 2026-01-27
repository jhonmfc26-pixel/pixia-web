export default function Footer() {
  return (
    <footer className="bg-black text-gray-400 pt-20 pb-10">
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-12">

        {/* Brand */}
        <div>
          <h3 className="text-white text-xl font-semibold mb-4">Pixia</h3>
          <p className="text-sm leading-relaxed">
            Transformamos tus recuerdos en libros fotográficos
            cinematográficos, creados con inteligencia artificial y calidad de impresión premium.
          </p>
        </div>

        {/* Product */}
        <div>
          <h4 className="text-white font-medium mb-3">Producto</h4>
          <ul className="space-y-2 text-sm">
            <li>Cómo funciona</li>
            <li>Ejemplos</li>
            <li>Precios</li>
            <li>Preguntas frecuentes</li>
          </ul>
        </div>

        {/* Company */}
        <div>
          <h4 className="text-white font-medium mb-3">Compañía</h4>
          <ul className="space-y-2 text-sm">
            <li>Sobre nosotros</li>
            <li>Contacto</li>
            <li>Privacidad</li>
            <li>Términos</li>
          </ul>
        </div>

        {/* Social */}
        <div>
          <h4 className="text-white font-medium mb-3">Síguenos</h4>
          <ul className="space-y-2 text-sm">
            <li>Instagram</li>
            <li>Facebook</li>
            <li>TikTok</li>
            <li>YouTube</li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10 mt-16 pt-6 text-center text-xs text-gray-500">
        © {new Date().getFullYear()} Pixia. Hecho con amor para convertir recuerdos en historias eternas.
      </div>
    </footer>
  );
}
