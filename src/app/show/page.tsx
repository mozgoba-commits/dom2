'use client'

import { useSimulationSSE } from '../../hooks/useSimulationSSE'
import { useViewport } from '../../hooks/useViewport'
import { useAudio } from '../../hooks/useAudio'
import HouseScene from '../../components/canvas/HouseScene'
import SpeechBubbles from '../../components/canvas/SpeechBubbles'
import ChatPanel from '../../components/ui/ChatPanel'
import AgentProfileCard from '../../components/ui/AgentProfileCard'
import VotingModal from '../../components/ui/VotingModal'
import EventNotification from '../../components/ui/EventNotification'
import AgentBar from '../../components/ui/AgentBar'
import StatusBar from '../../components/ui/StatusBar'
import LocationBar from '../../components/ui/LocationBar'
import RelationshipMap from '../../components/ui/RelationshipMap'
import TokShowOverlay from '../../components/ui/TokShowOverlay'
import EvictionScreen from '../../components/ui/EvictionScreen'
import ConfessionalView from '../../components/ui/ConfessionalView'
import Timeline from '../../components/ui/Timeline'
import MobileNav from '../../components/ui/MobileNav'
import { useViewStore } from '../../store/viewStore'
import { useSimulationStore } from '../../store/simulationStore'

export default function ShowPage() {
  useSimulationSSE()
  useViewport()
  useAudio()

  const isMobile = useViewStore(s => s.isMobile)
  const showChat = useViewStore(s => s.showChat)
  const showRelationshipMap = useViewStore(s => s.showRelationshipMap)
  const showTimeline = useViewStore(s => s.showTimeline)
  const selectedAgentId = useSimulationStore(s => s.selectedAgentId)

  return (
    <div className="h-screen flex flex-col bg-gray-950 overflow-hidden">
      {/* Status Bar */}
      <StatusBar />

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Canvas area */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 flex items-start justify-start p-2 overflow-auto relative">
            <div className="relative">
              <HouseScene />
              <SpeechBubbles />
            </div>
          </div>

          {/* Location quick-nav (hidden on mobile — replaced by MobileNav) */}
          {!isMobile && <LocationBar />}

          {/* Agent Bar */}
          <AgentBar />
        </div>

        {/* Chat Panel (desktop) */}
        {!isMobile && (
          <div className="w-80 flex-shrink-0">
            <ChatPanel />
          </div>
        )}
      </div>

      {/* Mobile bottom nav + chat */}
      {isMobile && (
        <>
          {showChat && (
            <div className="fixed inset-x-0 bottom-12 h-[50vh] z-20">
              <ChatPanel />
            </div>
          )}
          <MobileNav />
        </>
      )}

      {/* Event overlays */}
      <TokShowOverlay />
      <EvictionScreen />
      <ConfessionalView />

      {/* Modals */}
      {selectedAgentId && <AgentProfileCard />}
      {showRelationshipMap && <RelationshipMap />}
      {showTimeline && <Timeline />}
      <VotingModal />
      <EventNotification />
    </div>
  )
}
