"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";

export default function Header() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 w-full z-50 transition-all duration-300 ${
        scrolled
          ? "backdrop-blur-xl bg-black/60 shadow-lg py-3"
          : "bg-transparent py-5"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <Image
            src="/logo-pixia.png"
            alt="Pixia Logo"
            width={40}
            height={40}
            className="object-contain"
          />
          <span className="text-xl font-semibold tracking-tight bg-gradient-to-r from-orange-400 via-pink-400 to-fuchsia-500 bg-clip-text text-transparent">
            Pixia
          </span>
        </div>

        {/* Navigation */}
        <nav className="hidden md:flex items-center gap-8 text-sm text-white/80">
          <a href="#features" className="hover:text-white transition">
            Producto
          </a>
          <a href="#how" className="hover:text-white transition">
            Cómo funciona
          </a>
          <a href="#stories" className="hover:text-white transition">
            Historias
          </a>
          <a href="#pricing" className="hover:text-white transition">
            Precios
          </a>
        </nav>

        {/* CTA */}
        <Link href="/create">
          <button className="rounded-full px-5 py-2 text-sm font-medium bg-gradient-to-r from-orange-400 to-pink-500 text-white shadow-md hover:scale-105 transition">
            Crear mi álbum
          </button>
        </Link>
      </div>
    </header>
  );
}
