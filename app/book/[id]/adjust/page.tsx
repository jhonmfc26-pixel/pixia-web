'use client'

export const runtime = 'edge'

import { useState } from 'react'
import { pixiaBookMock } from '../../../../core/mocks/pixiaBook.mock'
import { createProposal } from '../../../../core/engine/createProposal'
import BookViewer from '../../../../components/book/BookViewer'
import { EditIntent } from '../../../../core/domain/PixiaEditSession'

export default function AdjustPage() {
  const [history, setHistory] = useState([pixiaBookMock])
  const [proposal, setProposal] = useState<{
    previewBook: typeof pixiaBookMock
    explanation: string
  } | null>(null)

  const currentBook = history[history.length - 1]

  const handleIntent = (intent: EditIntent) => {
    const newProposal = createProposal(currentBook, intent)
    setProposal(newProposal)
  }

  const handleAccept = () => {
    if (!proposal) return
    setHistory(prev => [...prev, proposal.previewBook])
    setProposal(null)
  }

  const handleReject = () => {
    setProposal(null)
  }

  const handleUndo = () => {
    if (history.length <= 1) return
    setHistory(prev => prev.slice(0, -1))
  }

  return (
    <main style={{ padding: 24 }}>
      <h1>Modo Ajuste Editorial</h1>

      <div style={{ marginBottom: 16 }}>
        <button onClick={handleUndo} disabled={history.length <= 1}>
          Deshacer
        </button>
        <span style={{ marginLeft: 16 }}>
          Versiones: {history.length}
        </span>
      </div>

      <hr style={{ margin: '24px 0' }} />

      {/* Vista comparativa */}
      {proposal ? (
        <div style={{ display: 'flex', gap: 24 }}>
          <div style={{ flex: 1 }}>
            <h3 style={{ textAlign: 'center' }}>Antes</h3>
            <BookViewer
              book={currentBook}
              onEmphasize={(photoId) =>
                handleIntent({ type: 'EMPHASIZE_PHOTO', photoId })
              }
              onReduceImpact={(photoId) =>
                handleIntent({ type: 'REDUCE_IMPACT', photoId })
              }
            />
          </div>

          <div style={{ flex: 1 }}>
            <h3 style={{ textAlign: 'center' }}>Propuesta Pixia</h3>
            <BookViewer
              book={proposal.previewBook}
              onEmphasize={() => {}}
              onReduceImpact={() => {}}
            />
          </div>
        </div>
      ) : (
        <BookViewer
          book={currentBook}
          onEmphasize={(photoId) =>
            handleIntent({ type: 'EMPHASIZE_PHOTO', photoId })
          }
          onReduceImpact={(photoId) =>
            handleIntent({ type: 'REDUCE_IMPACT', photoId })
          }
        />
      )}

      {/* Barra inferior de decisión */}
      {proposal && (
        <div
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            width: '100%',
            background: '#fff',
            borderTop: '1px solid #eee',
            padding: 20,
            boxShadow: '0 -2px 8px rgba(0,0,0,0.05)'
          }}
        >
          <p>{proposal.explanation}</p>

          <button onClick={handleAccept}>
            Aceptar propuesta
          </button>

          <button
            onClick={handleReject}
            style={{ marginLeft: 12 }}
          >
            Cancelar
          </button>
        </div>
      )}
    </main>
  )
}
