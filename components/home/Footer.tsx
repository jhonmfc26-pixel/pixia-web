"use client";

import Reveal from "@/components/ui/Reveal";

export default function Footer() {
  return (
    <footer className="bg-black text-gray-400 pt-20 pb-10">
      <div className="max-w-7xl mx-auto px-6">

        <Reveal>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
            
            {/* Marca */}
            <div>
              <h3 className="text-white font-semibold text-lg mb-4">Pixia</h3>
              <p className="text-sm leading-relaxed">
                Turning your memories into cinematic stories, beautifully
                designed and printed with AI.
              </p>
            </div>

            {/* Producto */}
            <div>
              <h4 className="text-white font-semibold mb-3">Product</h4>
              <ul className="space-y-2 text-sm">
                <li>Create Album</li>
                <li>How it Works</li>
                <li>Pricing</li>
                <li>Examples</li>
              </ul>
            </div>

            {/* Empresa */}
            <div>
              <h4 className="text-white font-semibold mb-3">Company</h4>
              <ul className="space-y-2 text-sm">
                <li>About</li>
                <li>Careers</li>
                <li>Contact</li>
                <li>Press</li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="text-white font-semibold mb-3">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li>Privacy Policy</li>
                <li>Terms of Service</li>
                <li>Cookies</li>
              </ul>
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.2}>
          <div className="border-t border-white/10 pt-6 flex flex-col md:flex-row items-center justify-between text-xs text-gray-500">
            <span>© {new Date().getFullYear()} Pixia. All rights reserved.</span>
            <span>Made with ❤️ and AI</span>
          </div>
        </Reveal>

      </div>
    </footer>
  );
}
