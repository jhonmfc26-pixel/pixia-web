'use client'
import type { LayoutSchema } from './types'

interface LayoutThumbnailProps {
  schema: LayoutSchema
  size?: number
  active?: boolean
}

function parseGridAreas(areasStr: string) {
  const rowStrings = areasStr.match(/"[^"]+"/g) ?? []
  const rows = rowStrings.map(r => r.replace(/"/g, '').trim().split(/\s+/))
  const slotMap = new Map<string, { rows: number[]; cols: number[] }>()
  rows.forEach((row, r) => {
    row.forEach((slot, c) => {
      if (!slotMap.has(slot)) slotMap.set(slot, { rows: [], cols: [] })
      slotMap.get(slot)!.rows.push(r)
      slotMap.get(slot)!.cols.push(c)
    })
  })
  const slots = new Map<string, { col: [number, number]; row: [number, number] }>()
  slotMap.forEach((data, name) => {
    slots.set(name, {
      col: [Math.min(...data.cols), Math.max(...data.cols) + 1],
      row: [Math.min(...data.rows), Math.max(...data.rows) + 1],
    })
  })
  return { numRows: rows.length, numCols: rows[0]?.length ?? 1, slots }
}

export default function LayoutThumbnail({ schema, size = 64, active = false }: LayoutThumbnailProps) {
  const isSpread = schema.scope === 'spread'
  const width = isSpread ? size * 2 : size
  const height = size

  const fillColor = active ? 'rgba(232,85,58,0.45)' : 'rgba(255,255,255,0.22)'
  const padding = 2
  const innerPaddingPct = schema.innerPadding ? parseFloat(schema.innerPadding) : 0

  if (isSpread) {
    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <rect x={padding} y={padding} width={width - padding * 2} height={height - padding * 2} fill={fillColor} rx={2} />
        <line x1={width / 2} y1={padding} x2={width / 2} y2={height - padding} stroke="rgba(0,0,0,0.25)" strokeWidth={1} strokeDasharray="2 2" />
      </svg>
    )
  }

  const { numRows, numCols, slots } = parseGridAreas(schema.grid.areas)
  const innerW = width - padding * 2
  const innerH = height - padding * 2
  const innerPadX = innerPaddingPct ? (innerW * innerPaddingPct) / 100 : 0
  const innerPadY = innerPaddingPct ? (innerH * innerPaddingPct) / 100 : 0
  const usableW = innerW - innerPadX * 2
  const usableH = innerH - innerPadY * 2
  const cellW = usableW / numCols
  const cellH = usableH / numRows
  const gap = 1

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {Array.from(slots.entries()).map(([slotName, pos]) => {
        const x = padding + innerPadX + pos.col[0] * cellW + gap / 2
        const y = padding + innerPadY + pos.row[0] * cellH + gap / 2
        const w = (pos.col[1] - pos.col[0]) * cellW - gap
        const h = (pos.row[1] - pos.row[0]) * cellH - gap
        return <rect key={slotName} x={x} y={y} width={w} height={h} fill={fillColor} rx={1.5} />
      })}
    </svg>
  )
}
