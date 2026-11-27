import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// El plugin de react-hooks viene dentro de eslint-config-next; se toma de ahí
// para poder ajustar sus reglas (abajo) sin depender de cómo lo registre cada
// versión de Next.
const reactHooksPlugin = nextVitals.find((c) => c.plugins?.["react-hooks"])?.plugins["react-hooks"];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Reglas de «preparación para el React Compiler» (react-hooks v6): señalan
  // patrones que el compilador no puede optimizar (setState dentro de un
  // efecto, leer refs al renderizar, memorización manual). El código funciona;
  // Pixia no usa el React Compiler. Quedan como aviso para irlas corrigiendo
  // sin bloquear los PR. Las pruebas automáticas (.github/workflows/checks.yml)
  // fallan con cualquier OTRO error de lint.
  {
    plugins: { "react-hooks": reactHooksPlugin },
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Código generado del contenedor del PDF.
    "services/pdf-render-container/dist/**",
    // Salida de OpenNext y estado local de wrangler.
    ".open-next/**",
    ".wrangler/**",
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
