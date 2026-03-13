'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSimulationStore } from '../../store/simulationStore'
import { useViewStore } from '../../store/viewStore'
import { getAccentColor } from '../canvas/spriteConfig'

interface RelAgent {
  id: string
  name: string
  accentColor: string
}

interface RelLink {
  agentA: string
  agentB: string
  friendship: number
  romance: number
  trust: number
  rivalry: number
  alliance: boolean
}

interface RelData {
  agents: RelAgent[]
  relationships: RelLink[]
}

const SVG_SIZE = 400
const CENTER = SVG_SIZE / 2
const RADIUS = 150
const NODE_R = 22

const REL_TYPES = [
  { key: 'romance', label: 'Романтика', color: '#e63946', check: (r: RelLink) => r.romance > 30 },
  { key: 'friendship', label: 'Дружба', color: '#2a9d8f', check: (r: RelLink) => r.friendship > 30 },
  { key: 'alliance', label: 'Альянс', color: '#ffd700', check: (r: RelLink) => r.alliance },
  { key: 'rivalry', label: 'Вражда', color: '#888888', check: (r: RelLink) => r.rivalry > 40 },
  { key: 'distrust', label: 'Недоверие', color: '#991111', check: (r: RelLink) => r.trust < -30 },
] as const

export default function RelationshipMap() {
  const agents = useSimulationStore(s => s.agents)
  const setSelectedAgent = useSimulationStore(s => s.setSelectedAgent)
  const toggleRelMap = useViewStore(s => s.toggleRelationshipMap)
  const [data, setData] = useState<RelData | null>(null)
  const [hoveredAgent, setHoveredAgent] = useState<string | null>(null)
  const [hoveredLink, setHoveredLink] = useState<{ a: string; b: string } | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/relationships')
      if (res.ok) {
        setData(await res.json())
      } else {
        // Fallback: use agents from store with empty relationships
        setData({
          agents: agents.map(a => ({ id: a.id, name: a.name, accentColor: getAccentColor(a.name) })),
          relationships: [],
        })
      }
    } catch {
      setData({
        agents: agents.map(a => ({ id: a.id, name: a.name, accentColor: getAccentColor(a.name) })),
        relationships: [],
      })
    } finally {
      setLoading(false)
    }
  }, [agents])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [fetchData])

  const close = () => toggleRelMap()

  const handleAgentClick = (id: string) => {
    setSelectedAgent(id)
    close()
  }

  if (!data && loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={close}>
        <div className="text-gray-400 text-sm">Загрузка...</div>
      </div>
    )
  }

  const agentList = data?.agents ?? []
  const rels = data?.relationships ?? []

  // Compute positions in a circle
  const positions: Record<string, { x: number; y: number }> = {}
  agentList.forEach((a, i) => {
    const angle = (i / agentList.length) * Math.PI * 2 - Math.PI / 2
    positions[a.id] = {
      x: CENTER + Math.cos(angle) * RADIUS,
      y: CENTER + Math.sin(angle) * RADIUS,
    }
  })

  // Count active links
  const activeLinks = rels.filter(r =>
    REL_TYPES.some(t => t.check(r))
  ).length

  // Build visible edges
  const edges: Array<{
    a: string; b: string; type: string; color: string;
    strokeWidth: number; dashArray?: string;
    rel: RelLink;
  }> = []

  for (const r of rels) {
    for (const t of REL_TYPES) {
      if (t.check(r)) {
        let value = 0
        if (t.key === 'romance') value = r.romance
        else if (t.key === 'friendship') value = r.friendship
        else if (t.key === 'rivalry') value = r.rivalry
        else if (t.key === 'alliance') value = 50
        else if (t.key === 'distrust') value = Math.abs(r.trust)

        const sw = Math.max(1, Math.min(4, value / 25))
        edges.push({
          a: r.agentA, b: r.agentB,
          type: t.key, color: t.color,
          strokeWidth: sw,
          dashArray: (t.key === 'rivalry' || t.key === 'distrust') ? '4,3' : undefined,
          rel: r,
        })
      }
    }
  }

  const isLinkedTo = (agentId: string, edge: typeof edges[0]) =>
    edge.a === agentId || edge.b === agentId

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={close}
    >
      <div
        className="bg-gray-900 rounded-xl border border-gray-700 p-4 max-w-[480px] w-full mx-4"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-white text-sm font-bold">Карта отношений</h2>
            <span className="text-gray-500 text-xs">{activeLinks} активных связей</span>
          </div>
          <button onClick={close} className="text-gray-500 hover:text-white text-lg px-2">&times;</button>
        </div>

        {/* SVG */}
        <svg
          viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
          className="w-full"
          style={{ maxHeight: '400px' }}
        >
          {/* Edges */}
          {edges.map((edge, i) => {
            const pa = positions[edge.a]
            const pb = positions[edge.b]
            if (!pa || !pb) return null

            const dimmed = hoveredAgent && !isLinkedTo(hoveredAgent, edge)
            const highlighted = hoveredLink && hoveredLink.a === edge.a && hoveredLink.b === edge.b && hoveredLink.a === edge.a

            // Offset parallel edges between same pair
            const pairEdges = edges.filter(e => (e.a === edge.a && e.b === edge.b) || (e.a === edge.b && e.b === edge.a))
            const pairIdx = pairEdges.indexOf(edge)
            const offset = (pairIdx - (pairEdges.length - 1) / 2) * 4

            const mx = (pa.x + pb.x) / 2
            const my = (pa.y + pb.y) / 2
            const dx = pb.x - pa.x
            const dy = pb.y - pa.y
            const len = Math.sqrt(dx * dx + dy * dy)
            const nx = -dy / len * offset
            const ny = dx / len * offset

            return (
              <g key={`${edge.a}-${edge.b}-${edge.type}-${i}`}>
                <line
                  x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y}
                  stroke={edge.color}
                  strokeWidth={highlighted ? edge.strokeWidth + 1 : edge.strokeWidth}
                  strokeDasharray={edge.dashArray}
                  opacity={dimmed ? 0.15 : 0.7}
                  transform={`translate(${nx},${ny})`}
                />
                {/* Invisible wider line for hover target */}
                <line
                  x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y}
                  stroke="transparent"
                  strokeWidth={12}
                  transform={`translate(${nx},${ny})`}
                  onMouseEnter={() => setHoveredLink({ a: edge.a, b: edge.b })}
                  onMouseLeave={() => setHoveredLink(null)}
                  style={{ cursor: 'pointer' }}
                />
                {/* Romance hearts */}
                {edge.type === 'romance' && !dimmed && (
                  <text
                    x={mx + nx} y={my + ny - 4}
                    textAnchor="middle" fontSize="10" fill={edge.color}
                    opacity={0.8}
                  >
                    *
                  </text>
                )}
              </g>
            )
          })}

          {/* Nodes */}
          {agentList.map(agent => {
            const pos = positions[agent.id]
            if (!pos) return null
            const dimmed = hoveredAgent && hoveredAgent !== agent.id &&
              !edges.some(e => isLinkedTo(hoveredAgent, e) && isLinkedTo(agent.id, e))

            return (
              <g
                key={agent.id}
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHoveredAgent(agent.id)}
                onMouseLeave={() => setHoveredAgent(null)}
                onClick={() => handleAgentClick(agent.id)}
                opacity={dimmed ? 0.3 : 1}
              >
                <circle
                  cx={pos.x} cy={pos.y} r={NODE_R}
                  fill={agent.accentColor + '33'}
                  stroke={agent.accentColor}
                  strokeWidth={hoveredAgent === agent.id ? 2.5 : 1.5}
                />
                <text
                  x={pos.x} y={pos.y + 1}
                  textAnchor="middle" dominantBaseline="middle"
                  fontSize="11" fontWeight="bold" fill="white"
                >
                  {agent.name.slice(0, 4)}
                </text>
                <text
                  x={pos.x} y={pos.y + NODE_R + 12}
                  textAnchor="middle" fontSize="9" fill="#aaa"
                >
                  {agent.name}
                </text>
              </g>
            )
          })}

          {/* Tooltip for hovered link */}
          {hoveredLink && (() => {
            const rel = rels.find(r =>
              (r.agentA === hoveredLink.a && r.agentB === hoveredLink.b) ||
              (r.agentA === hoveredLink.b && r.agentB === hoveredLink.a)
            )
            if (!rel) return null
            const pa = positions[hoveredLink.a]
            const pb = positions[hoveredLink.b]
            if (!pa || !pb) return null
            const tx = (pa.x + pb.x) / 2
            const ty = (pa.y + pb.y) / 2

            return (
              <g>
                <rect x={tx - 50} y={ty - 40} width={100} height={50} rx={4}
                  fill="#1a1a2e" stroke="#555" strokeWidth={0.5} opacity={0.95} />
                <text x={tx} y={ty - 26} textAnchor="middle" fontSize="8" fill="#e63946">
                  Ром. {rel.romance}
                </text>
                <text x={tx} y={ty - 16} textAnchor="middle" fontSize="8" fill="#2a9d8f">
                  Друж. {rel.friendship}
                </text>
                <text x={tx} y={ty - 6} textAnchor="middle" fontSize="8" fill="#888">
                  Вражд. {rel.rivalry} | Дов. {rel.trust}
                </text>
                {rel.alliance && (
                  <text x={tx} y={ty + 4} textAnchor="middle" fontSize="8" fill="#ffd700">
                    Альянс
                  </text>
                )}
              </g>
            )
          })()}
        </svg>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 mt-3 justify-center">
          {REL_TYPES.map(t => (
            <div key={t.key} className="flex items-center gap-1 text-[10px] text-gray-400">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.color }} />
              {t.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
