'use client'

import { useState } from 'react'
import type { PhotoAsset } from '@/core/contracts/AlbumBlueprint'
import type { DedicationContent } from '@/core/modules/foldModel/types'
import { DEDICATION_HEADING_FONTS, DEDICATION_BODY_FONTS } from './fonts'
import { HEADING_MAX, BODY_MAX, SIGNATURE_MAX } from './limits'
import { DedicationCard } from './DedicationCard'

const FIELD_LABEL: React.CSSProperties = {
  fontSize: '10px', color: 'rgba(255,255,255,0.32)',
  textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px', display: 'block',
  fontFamily: 'inherit', // controles siempre en la tipografía del sistema — la bonita es solo para la carta
}

// Sin marginBottom acá a propósito — el espacio de cierre de cada campo lo
// pone CharCounter (label + input + contador viajan juntos como una unidad).
const FIELD_INPUT: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  padding: '10px 12px',
  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)',
  borderRadius: '8px', color: '#fff', fontSize: '14px', outline: 'none',
  fontFamily: 'inherit',
}

/**
 * Contador "128 / 350" bajo cada campo. maxLength en el input ya impide
 * pasarse — esto es el feedback visual de que se está por llegar al tope
 * (>90% → ámbar tenue), no una validación aparte.
 */
function CharCounter({ value, max }: { value: string; max: number }) {
  const len = value.length
  const isNearLimit = len >= max * 0.9
  return (
    <div style={{
      textAlign: 'right', fontSize: '11px',
      marginTop: '4px', marginBottom: '16px',
      color: isNearLimit ? '#D9A441' : 'rgba(255,255,255,0.28)',
      transition: 'color 0.15s',
    }}>
      {len} / {max}
    </div>
  )
}

/** Solo los campos "editables en vivo sin efecto secundario" — la foto queda fuera (ver comentario más abajo). */
type DedicationDraft = Pick<DedicationContent, 'heading' | 'body' | 'signature' | 'headingFont' | 'bodyFont'>

function draftFrom(d: DedicationContent): DedicationDraft {
  return { heading: d.heading, body: d.body, signature: d.signature, headingFont: d.headingFont, bodyFont: d.bodyFont }
}

interface DedicationEditorProps {
  dedication: DedicationContent
  photo: PhotoAsset | undefined
  bagPhotos: PhotoAsset[]
  uploading: boolean
  uploadCount: number
  /** Se llama UNA vez, al pulsar "Guardar dedicatoria" — no en cada tecla. */
  onSave: (patch: Partial<DedicationContent>) => void
  onPickPhoto: (photoId: string) => void
  onRemovePhoto: () => void
  onUploadNew: () => void
  onRevert: () => void
  onClose: () => void
}

const SPLIT_CSS = `
  .ded-split { display: flex; flex-direction: row; flex: 1; min-height: 0; }
  .ded-preview { width: 58%; display: flex; align-items: center; justify-content: center; padding: 32px; box-sizing: border-box; }
  .ded-controls { width: 42%; overflow-y: auto; padding: 20px; box-sizing: border-box; border-left: 1px solid rgba(255,255,255,0.07); }
  @media (max-width: 768px) {
    .ded-split { flex-direction: column; overflow-y: auto; }
    .ded-preview { width: 100%; flex-shrink: 0; padding: 20px 20px 8px; }
    .ded-controls { width: 100%; border-left: none; border-top: 1px solid rgba(255,255,255,0.07); overflow-y: visible; }
  }
`

/**
 * Editor de dedicatoria — vista lado a lado (carta en vivo a la izquierda,
 * controles a la derecha), NUNCA un modal que tape la carta mientras se
 * edita. En pantallas angostas se apila (carta arriba, controles abajo,
 * scrolleable) vía la media query de SPLIT_CSS, no con JS.
 *
 * Texto/tipografía viven en un DRAFT local: cada tecla actualiza la
 * preview al instante (sin llamar al padre), y recién se commitea a la
 * structure real del álbum al pulsar "Guardar dedicatoria" — así
 * "Cancelar" tiene sentido de verdad (descarta el draft sin tocar nada).
 * La foto es la excepción: elegir de la bolsa o subir una nueva son
 * acciones con efecto real (la subida ya pasa por R2 y queda en el
 * blueprint pase lo que pase, igual que en el resto del editor) — por
 * consistencia con cómo se comporta la subida en todo Pixia, esas
 * siguen commiteando de inmediato en vez de vivir en el draft.
 */
export default function DedicationEditor({
  dedication, photo, bagPhotos, uploading, uploadCount,
  onSave, onPickPhoto, onRemovePhoto, onUploadNew, onRevert, onClose,
}: DedicationEditorProps) {
  const [draft, setDraft] = useState<DedicationDraft>(() => draftFrom(dedication))
  const previewDedication: DedicationContent = { ...draft, photoId: dedication.photoId }

  const handleSave = () => {
    onSave(draft)
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 150, background: 'rgba(0,0,0,0.96)', display: 'flex', flexDirection: 'column' }}>
      <style>{SPLIT_CSS}</style>

      {/* Cabecera */}
      <div style={{
        height: '56px', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 20px', borderBottom: '1px solid rgba(255,255,255,0.07)',
      }}>
        <span style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }}>Dedicatoria</span>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.45)', fontSize: '22px', lineHeight: 1, cursor: 'pointer', padding: '4px' }}
        >
          ✕
        </button>
      </div>

      <div className="ded-split">
        {/* Izquierda — preview en vivo, mismo componente que el viewer 3D */}
        <div className="ded-preview">
          <div style={{
            width: '100%', maxWidth: '440px', aspectRatio: '1',
            borderRadius: '8px', overflow: 'hidden',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          }}>
            <DedicationCard dedication={previewDedication} photo={photo} />
          </div>
        </div>

        {/* Derecha — controles, tipografía del sistema */}
        <div className="ded-controls">
          <label style={FIELD_LABEL}>Encabezado</label>
          <input
            type="text"
            value={draft.heading}
            onChange={e => setDraft(prev => ({ ...prev, heading: e.target.value }))}
            maxLength={HEADING_MAX}
            placeholder="Para ti"
            style={FIELD_INPUT}
          />
          <CharCounter value={draft.heading} max={HEADING_MAX} />

          <label style={FIELD_LABEL}>Cuerpo</label>
          <textarea
            value={draft.body}
            onChange={e => setDraft(prev => ({ ...prev, body: e.target.value }))}
            maxLength={BODY_MAX}
            placeholder="Escribe tu mensaje..."
            rows={5}
            style={{ ...FIELD_INPUT, resize: 'vertical', lineHeight: 1.5 }}
          />
          <CharCounter value={draft.body} max={BODY_MAX} />

          <label style={FIELD_LABEL}>Firma</label>
          <input
            type="text"
            value={draft.signature}
            onChange={e => setDraft(prev => ({ ...prev, signature: e.target.value }))}
            maxLength={SIGNATURE_MAX}
            placeholder="Con cariño"
            style={FIELD_INPUT}
          />
          <CharCounter value={draft.signature} max={SIGNATURE_MAX} />

          <label style={FIELD_LABEL}>Tipografía del encabezado</label>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap' }}>
            {DEDICATION_HEADING_FONTS.map(f => (
              <button
                key={f.id}
                onClick={() => setDraft(prev => ({ ...prev, headingFont: f.id as DedicationContent['headingFont'] }))}
                style={{
                  padding: '8px 14px', borderRadius: '7px',
                  border: draft.headingFont === f.id ? '1.5px solid #E8553A' : '1px solid rgba(255,255,255,0.14)',
                  background: draft.headingFont === f.id ? 'rgba(232,85,58,0.12)' : 'rgba(255,255,255,0.04)',
                  color: '#fff', fontFamily: f.cssFamily, fontSize: '16px', cursor: 'pointer',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          <label style={FIELD_LABEL}>Tipografía del cuerpo</label>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '20px', flexWrap: 'wrap' }}>
            {DEDICATION_BODY_FONTS.map(f => (
              <button
                key={f.id}
                onClick={() => setDraft(prev => ({ ...prev, bodyFont: f.id as DedicationContent['bodyFont'] }))}
                style={{
                  padding: '8px 14px', borderRadius: '7px',
                  border: draft.bodyFont === f.id ? '1.5px solid #E8553A' : '1px solid rgba(255,255,255,0.14)',
                  background: draft.bodyFont === f.id ? 'rgba(232,85,58,0.12)' : 'rgba(255,255,255,0.04)',
                  color: '#fff', fontFamily: f.cssFamily, fontSize: '14px', cursor: 'pointer',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Foto opcional — reusa bolsa/subir; commitea de inmediato (ver comentario arriba del componente) */}
          <label style={FIELD_LABEL}>Foto (opcional)</label>
          {photo ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '6px', overflow: 'hidden', flexShrink: 0 }}>
                <img src={photo.thumbnailUrl || photo.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              </div>
              <button
                onClick={onRemovePhoto}
                style={{
                  background: 'none', border: '1px solid rgba(255,255,255,0.14)', borderRadius: '7px',
                  padding: '8px 14px', color: 'rgba(255,255,255,0.6)', fontSize: '13px', cursor: 'pointer',
                }}
              >
                Quitar foto
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={onUploadNew}
                disabled={uploading}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  padding: '12px', marginBottom: '10px',
                  border: '1.5px dashed rgba(255,255,255,0.18)', borderRadius: '10px',
                  background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.45)',
                  fontSize: '13px', cursor: uploading ? 'default' : 'pointer',
                }}
              >
                {uploading ? (uploadCount > 1 ? `Subiendo ${uploadCount} fotos...` : 'Subiendo foto...') : 'Subir nueva foto'}
              </button>

              {bagPhotos.length > 0 && (
                <>
                  <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.32)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
                    O elige de tu bolsa
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))', gap: '6px', marginBottom: '16px' }}>
                    {bagPhotos.map(p => (
                      <button
                        key={p.id}
                        onClick={() => onPickPhoto(p.id)}
                        style={{ aspectRatio: '1', padding: 0, border: 'none', borderRadius: '6px', overflow: 'hidden', cursor: 'pointer', background: '#1a1a1a' }}
                      >
                        <img src={p.thumbnailUrl || p.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      </button>
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          <button
            onClick={onRevert}
            style={{
              width: '100%', padding: '11px', marginTop: '4px',
              border: '1px solid rgba(255,255,255,0.14)', borderRadius: '8px',
              background: 'transparent', color: 'rgba(255,255,255,0.55)', fontSize: '13px', cursor: 'pointer',
            }}
          >
            Volver a página de fotos
          </button>
        </div>
      </div>

      {/* Pie — Cancelar descarta el draft de texto/tipografía (la foto, si se
          tocó, ya quedó commiteada — ver comentario arriba del componente) */}
      <div style={{
        flexShrink: 0, padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', gap: '10px',
      }}>
        <button
          onClick={onClose}
          style={{
            flex: 1, padding: '12px',
            border: '1px solid rgba(255,255,255,0.14)', borderRadius: '8px',
            background: 'transparent', color: 'rgba(255,255,255,0.55)', fontSize: '14px', cursor: 'pointer',
          }}
        >
          Cancelar
        </button>
        <button
          onClick={handleSave}
          style={{
            flex: 2, padding: '12px',
            border: 'none', borderRadius: '8px',
            background: '#E8553A', color: '#fff', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
          }}
        >
          Guardar dedicatoria
        </button>
      </div>
    </div>
  )
}
