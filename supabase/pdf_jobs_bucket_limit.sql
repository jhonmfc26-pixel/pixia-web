-- Fix encontrado en la validación en vivo: el bucket `pdfs` (creado en
-- pdf_jobs.sql, ya corrido) usa el límite de tamaño de archivo por default
-- de Supabase Storage — insuficiente: una página del interior (hero-spread
-- de una sola foto a página completa) superó ese límite al subirla.
-- Sube el tope a 200MB (barato, no hay costo real por permitirlo — el
-- objeto real termina siendo bastante más chico, esto es solo margen).
--
-- Causa raíz probable (NO se toca acá, queda para otro ticket): Chromium
-- puede re-codificar imágenes al generar PDF vía page.pdf(), inflando
-- bastante el tamaño de una página con una sola foto a sangre completa
-- comparado con el tamaño de la foto JPEG original. Vale la pena revisar,
-- pero no es parte de este rediseño (que es de arquitectura async, no de
-- generación/calidad de PDF).

UPDATE storage.buckets SET file_size_limit = 200 * 1024 * 1024 WHERE id = 'pdfs';
