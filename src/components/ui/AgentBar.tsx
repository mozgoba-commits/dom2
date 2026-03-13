'use client'

import { useSimulationStore } from '../../store/simulationStore'

const MOOD_DOT_COLOR: Record<string, string> = {
  happy: 'bg-green-500', angry: 'bg-red-500', sad: 'bg-blue-500', excited: 'bg-yellow-400',
  jealous: 'bg-amber-600', flirty: 'bg-pink-500', bored: 'bg-gray-500', anxious: 'bg-purple-400',
  neutral: 'bg-gray-400', annoyed: 'bg-orange-500', devastated: 'bg-blue-700', euphoric: 'bg-emerald-400', scheming: 'bg-violet-500',
}

const AGENT_COLORS = [
  'bg-red-600', 'bg-blue-600', 'bg-orange-500', 'bg-pink-600',
  'bg-teal-600', 'bg-yellow-500', 'bg-green-600', 'bg-purple-600',
]

export default function AgentBar() {
  const agents = useSimulationStore(s => s.agents)
  const selectedAgentId = useSimulationStore(s => s.selectedAgentId)
  const setSelectedAgent = useSimulationStore(s => s.setSelectedAgent)

  return (
    <div className="flex gap-2 p-2 bg-gray-900/95 border-t border-gray-700 overflow-x-auto">
      {agents.map((agent, i) => (
        <button
          key={agent.id}
          onClick={() => setSelectedAgent(agent.id === selectedAgentId ? null : agent.id)}
          className={`flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all text-sm ${
            agent.id === selectedAgentId
              ? 'border-white bg-gray-700'
              : 'border-gray-700 bg-gray-800 hover:border-gray-500'
          }`}
        >
          <div className={`w-6 h-6 rounded-full ${AGENT_COLORS[i % AGENT_COLORS.length]} flex items-center justify-center text-[10px] text-white font-bold`}>
            {agent.name[0]}
          </div>
          <span className="text-white text-xs font-medium">{agent.name}</span>
          <span className={`w-2 h-2 rounded-full ${MOOD_DOT_COLOR[agent.mood] ?? 'bg-gray-400'}`} />
        </button>
      ))}
    </div>
  )
}
