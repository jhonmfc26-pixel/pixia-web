# Pixia — Editorial Intelligence Design

> Design doc. NO es código aún — es el blueprint que se ejecutará después de terminar
> Sprint E (PDF + Wompi + envío a imprenta).
>
> **Estado:** aprobado en discusión, pendiente implementación.
> **Versión:** 1.0
> **Última actualización:** Junio 2026

---

## 1. Contexto y motivación

Pixia ya toma decisiones editoriales hoy:
- Cuál foto va a portada
- Cuáles fotos se descartan
- Cuál foto cruza dos páginas (hero-spread)
- Cuántas páginas tiene el álbum
- En qué orden van las fotos

El problema **no es que estas decisiones no existan** — es que están enterradas dentro
de `buildPixiaBook.ts` y la API `/api/editorial`. Son **implícitas, no auditables,
no inspeccionables**.

Esta capa se llama **Editorial Intelligence** y su objetivo es **formalizar lo que
ya existe**, no agregar inteligencia nueva. Sell pitch:

- ❌ "Agreguemos inteligencia editorial nueva"
- ✅ "Extraigamos y formalicemos la inteligencia editorial que ya tenemos, hoy implícita"

---

## 2. Arquitectura

### Actual
```
PhotoAnalysis → AlbumBlueprint → Viewer/Editor
```

### Objetivo
```
PhotoAnalysis → EditorialAnalysis → AlbumBlueprint → Viewer/Editor
```

**Claves:**
- `EditorialAnalysis` se computa **después** del análisis individual de fotos y
  **antes** de armar el book.
- `buildPixiaBook` deja de tomar decisiones editoriales propias — se vuelve un
  **componedor** que aplica las decisiones que `EditorialAnalysis` ya tomó.
- Se persiste como campo opcional del `AlbumBlueprint` para retrocompatibilidad.

---

## 3. Interface `EditorialAnalysis`

```typescript
interface EditorialAnalysis {
  /** Tipo de evento, declarado por el usuario en el wizard. */
  eventType: 'wedding' | 'travel' | 'family' | 'birthday' | 'other'
  
  /** Cantidad sugerida de páginas físicas. */
  recommendedPageCount: number
  
  /** Razón humanamente legible detrás del page count. Para transparencia. */
  pageCountReason: string  
  // Ejemplo: "44 fotos analizadas, 40 usables, ratio 0.6 → 24 páginas"
  
  /** Fotos clasificadas. Reemplaza el score implícito. */
  classification: {
    hero: string[]        // photoIds. Las más fuertes.
    supporting: string[]  // Las que complementan.
    discard: string[]     // Las que NO van al álbum.
  }
  
  /** Foto recomendada para portada con justificación. */
  suggestedCover: {
    photoId: string
    reason: string  
    // Ejemplo: "Mejor score (8.7) + retrato vertical + horario óptimo"
  }
  
  /** Foto recomendada para hero-spread, si aplica. */
  suggestedHeroSpread: {
    photoId: string
    reason: string
  } | null
  
  /** Para invalidación de cache si cambian las fotos. */
  generatedAt: string  // ISO timestamp
  
  /** Versión del algoritmo. Permite re-cómputo si la lógica mejora. */
  algorithmVersion: string  // ejemplo: "1.0.0"
}
```

### Justificación del scope

**Lo que está dentro:**
- `eventType` → declarado por usuario, no inferido. Fuente confiable.
- `recommendedPageCount` + `pageCountReason` → si usuario pregunta "¿por qué 28 páginas?", hay respuesta concreta.
- `classification` → reemplaza scores implícitos, hace explícito qué fotos van.
- `suggestedCover` y `suggestedHeroSpread` con `reason` → las dos decisiones más visibles del álbum, merecen justificación.

**Lo que se decidió NO incluir (por ahora):**
- ❌ `narrativeArc` (intro/development/climax/closing) → pretencioso para v1. Sin IA, solo se puede calcular con heurística temporal frágil. Posponer a v2 con data real de uso.
- ❌ `keyMoments[]` → redundante con `classification.hero`. Las hero ya son los key moments.

---

## 4. Integración con el flujo

```
1. Upload + análisis individual de fotos
        ↓
2. Wizard pide: eventType, título, fecha
        ↓
3. EditorialAnalysis se computa
   - Lee PhotoAsset (score, orientation, takenAt)
   - Lee userInput (eventType)
   - Produce classification + suggestedCover + recommendedPageCount
        ↓
4. buildPixiaBook (existente, REFACTORIZADO)
   - LEE editorial.classification.hero|supporting → qué fotos usar
   - LEE editorial.recommendedPageCount → target de páginas
   - LEE editorial.suggestedCover.photoId → portada por default
   - LEE editorial.suggestedHeroSpread → para hero-spread layout
   - Produce: spreads[] con layouts asignados
        ↓
5. AlbumBlueprint completo con editorial embedded
        ↓
6. Viewer / Editor
```

**Cambio importante en `AlbumBlueprint`:**

```typescript
interface AlbumBlueprint {
  // ... campos existentes
  editorial?: EditorialAnalysis  // opcional, retrocompatible
}
```

Álbumes viejos sin `editorial` siguen funcionando — `buildPixiaBook` puede tener un fallback que recalcula al vuelo si no existe.

---

## 5. Algoritmos de cómputo

### 5.1 `eventType` detection

**Fuente primaria: declaración del usuario.**

Agregar step al wizard de creación:
> "¿Qué tipo de álbum es?"
> ○ Boda  ○ Viaje  ○ Familia  ○ Cumpleaños  ○ Otro

**Fallback heurístico** (si usuario no especifica):
- Si timestamps abarcan < 24h → `birthday` o `wedding` (default `other`)
- Si > 1 día y < 30 días → `travel`
- Si > 90 días → `family`

⚠️ Las heurísticas tienen ~30% de error. Preferir siempre input del usuario.

### 5.2 `classification` (hero/supporting/discard)

Basado en scoring de cada PhotoAsset:

```typescript
function classify(photos: PhotoAsset[]): Classification {
  // Asumiendo score 0-10
  const sorted = photos.sort((a, b) => b.score - a.score)
  
  // Reglas:
  // - Discard: bottom 10% si score < 4 (foto técnicamente mala)
  // - Hero: top 20% con score >= 8 (fotos excepcionales)
  // - Supporting: el resto (la mayoría)
  
  return {
    hero: sorted.filter(p => p.score >= 8).slice(0, Math.ceil(photos.length * 0.2)).map(p => p.id),
    discard: sorted.filter(p => p.score < 4).map(p => p.id),
    supporting: sorted.filter(p => p.score >= 4 && p.score < 8).map(p => p.id),
  }
}
```

Los thresholds (4, 8, 20%) son ajustables. Iterar con feedback de usuarios.

### 5.3 `recommendedPageCount`

```typescript
function computePageCount(usableCount: number): { count: number; reason: string } {
  let ratio: number
  if (usableCount <= 30) ratio = 0.7
  else if (usableCount <= 60) ratio = 0.6
  else ratio = 0.5
  
  let pages = Math.ceil(usableCount * ratio)
  pages = Math.max(12, Math.min(40, pages))   // clamp 12-40
  if (pages % 2 !== 0) pages++                // ajustar a par (spreads completos)
  
  return {
    count: pages,
    reason: `${usableCount} fotos usables, ratio ${ratio} → ${pages} páginas (ajustado a par)`
  }
}
```

Los ratios (0.7 / 0.6 / 0.5) son negociables con el proveedor de imprenta.

### 5.4 `suggestedCover`

Heurística ponderada:

```typescript
function pickCover(photos: PhotoAsset[]): { photoId: string; reason: string } {
  const candidates = photos.map(p => ({
    photo: p,
    coverScore: 
      p.score * 0.4 +                    // calidad técnica
      (p.orientation === 'portrait' ? 2 : 0) +   // portrait suele verse mejor en portada
      (isMidDay(p.takenAt) ? 1 : 0) +    // mejor iluminación
      (hasGoodComposition(p) ? 1.5 : 0)
  }))
  
  const best = candidates.sort((a, b) => b.coverScore - a.coverScore)[0]
  
  const reasons: string[] = []
  if (best.photo.score >= 8) reasons.push(`score ${best.photo.score.toFixed(1)}`)
  if (best.photo.orientation === 'portrait') reasons.push('orientación vertical')
  if (isMidDay(best.photo.takenAt)) reasons.push('horario óptimo')
  
  return {
    photoId: best.photo.id,
    reason: reasons.join(' + ')
  }
}
```

### 5.5 `suggestedHeroSpread`

Solo si hay alguna foto **landscape con muy alto score** (>= 9) que merezca cruzar
2 páginas. Si ninguna califica, `suggestedHeroSpread = null` (no se sugiere).

```typescript
function pickHeroSpread(photos: PhotoAsset[]): { photoId: string; reason: string } | null {
  const candidate = photos
    .filter(p => p.orientation === 'landscape' && p.score >= 9)
    .sort((a, b) => b.score - a.score)[0]
  
  if (!candidate) return null
  
  return {
    photoId: candidate.id,
    reason: `landscape excepcional (score ${candidate.score.toFixed(1)})`
  }
}
```

---

## 6. Trade-offs y decisiones explícitas

### 6.1 ¿Por qué heurística en lugar de IA generativa?

**Decisión:** Empezar con heurística determinística.

**Razones:**
- Predecible y debugeable
- Sin costos por usuario
- Justificable explícitamente
- Suficiente para v1

**Cuándo migrar a IA:**
- Cuando los usuarios reporten frustración con sugerencias
- Cuando se valide que pagarían por "edición premium con IA"
- Cuando exista feedback real para entrenar prompts

### 6.2 ¿Por qué persistir editorial en AlbumBlueprint?

**Decisión:** Campo opcional `editorial?: EditorialAnalysis` en blueprint.

**Razones:**
- Retrocompatibilidad: álbumes viejos siguen funcionando sin `editorial`
- Auditabilidad: el usuario puede VER las decisiones
- Performance: no se recalcula en cada render
- Cache invalidation simple: `generatedAt` + `algorithmVersion`

**Trade-off:** mayor tamaño de localStorage / DB. Mitigable porque son pocos campos.

### 6.3 ¿Por qué `eventType` declarado en lugar de inferido?

**Decisión:** Pedirle al usuario en el wizard.

**Razones:**
- Heurísticas de detección fallan ~30% del tiempo
- Equivocarse en tipo de evento → cascada de errores en todo lo demás
- Es 1 click adicional para el usuario, costo bajo
- Permite filtrar layouts y prompts según evento

**Trade-off:** un step más en el wizard. Mitigable poniéndolo en la pantalla de upload.

---

## 7. Plan de implementación (cuando llegue el momento)

### Sprint X.1 — Estructura base
1. Crear `core/modules/editorial/types.ts` con interface `EditorialAnalysis`
2. Crear `core/modules/editorial/compute.ts` con funciones puras
3. Agregar `editorial?: EditorialAnalysis` al `AlbumBlueprint`
4. Tests unitarios de cada función de cómputo (sin dependencias externas)

### Sprint X.2 — Integración con wizard
1. Agregar step `eventType` al wizard
2. Llamar `computeEditorial()` después del upload + análisis
3. Persistir editorial en localStorage junto con book

### Sprint X.3 — Refactor de buildPixiaBook
1. `buildPixiaBook` lee de `book.editorial` en lugar de calcular propio
2. Fallback si `editorial` no existe (álbumes viejos)
3. Validar que NO cambia comportamiento observable

### Sprint X.4 — UI de transparencia
1. Mostrar al usuario en algún lugar: "Tu álbum sugiere 24 páginas porque tienes 40 fotos usables"
2. Permitir override manual: usuario puede pedir más/menos páginas
3. Mostrar reason en tooltip de portada: "Esta es tu portada porque tiene score 8.7"

### Sprint X.5 — Mejoras (cuando haya data real)
1. Ajustar thresholds basados en feedback de usuarios reales
2. Considerar agregar `narrativeArc` si hay demanda
3. Considerar IA generativa como upgrade premium

---

## 8. Open questions

Preguntas sin respuesta clara, pendientes de validar con usuarios reales o con el proveedor de imprenta:

1. **¿Los ratios de páginas (0.7/0.6/0.5) son los correctos?** Depende del costo por página y de qué considere el proveedor "bien curado". Confirmar en reunión con imprenta.

2. **¿`eventType` debería tener más opciones?** Boda/viaje/familia/cumpleaños cubre 80% del caso, pero podría faltar "graduación", "embarazo", "primer año del bebé", etc. Empezar con 4-5 y expandir según demanda.

3. **¿`narrativeArc` se agrega en algún momento?** Decisión pendiente, depende de feedback de usuarios y de si se incorpora IA generativa.

4. **¿La editorial se re-computa cuando el usuario reordena fotos manualmente?** Hipótesis: NO, porque el usuario ya tomó la decisión. Pero `algorithmVersion` permite forzar recompute si lo necesitamos.

5. **¿`classification.discard` se muestra al usuario?** Si dices "descartamos 10 fotos", el usuario podría querer ver cuáles. Pero también podría no importarle. Decisión UX pendiente.

---

## 9. Referencias internas

- `core/modules/album/buildPixiaBook.ts` — actual lógica que será refactorizada
- `app/api/editorial/route.ts` — endpoint actual que será reemplazado/complementado
- `core/contracts/AlbumBlueprint.ts` — donde se agregará el campo `editorial?`
- `core/modules/album/pageEngine.ts` — consumidor de las decisiones editoriales

---

## 10. Nota final

Este documento se aprobó en discusión pero NO se ha implementado. La implementación
empezará después de cerrar Sprint E (PDF + Wompi + envío imprenta). Si en ese tiempo
se descubre algo que invalide partes de este diseño, **actualizar este documento ANTES**
de empezar a codear.
