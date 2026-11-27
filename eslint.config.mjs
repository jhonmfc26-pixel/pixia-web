import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

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
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
