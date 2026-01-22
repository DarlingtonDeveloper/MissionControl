import { useState, useCallback } from 'react'
import { useMissionStore, startKing, stopKing } from '../stores/useMissionStore'
import { KingHeader } from './KingHeader'
import { TeamOverview } from './TeamOverview'
import { WorkersPanel } from './WorkersPanel'
import { AgentTerminal } from './AgentTerminal'

interface KingPanelProps {
  onExit: () => void
  onAgentClick?: (agentId: string) => void
}

// King's tmux session name (must match orchestrator/bridge/king.go)
const KING_SESSION_NAME = 'mc-king'

export function KingPanel({ onExit, onAgentClick }: KingPanelProps) {
  const kingRunning = useMissionStore((s) => s.kingRunning)
  const [startingKing, setStartingKing] = useState(false)
  const [showWorkers, setShowWorkers] = useState(false)
  const [terminalConnected, setTerminalConnected] = useState(false)

  const handleStartKing = async () => {
    setStartingKing(true)
    try {
      await startKing()
    } catch (err) {
      console.error('Failed to start King:', err)
    } finally {
      setStartingKing(false)
    }
  }

  const handleStopKing = async () => {
    try {
      await stopKing()
    } catch (err) {
      console.error('Failed to stop King:', err)
    }
  }

  const handleConnectionChange = useCallback((connected: boolean) => {
    setTerminalConnected(connected)
  }, [])

  return (
    <div className="flex-1 flex flex-col bg-gray-950 overflow-hidden" data-testid="king-panel">
      {/* Header with status */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <KingHeader onExit={onExit} />
          {/* King status indicator */}
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${
              kingRunning
                ? terminalConnected
                  ? 'bg-green-500 animate-pulse'
                  : 'bg-yellow-500'
                : 'bg-gray-500'
            }`} />
            <span className="text-[10px] text-gray-500">
              {startingKing ? 'Starting...' : kingRunning ? (terminalConnected ? 'Connected' : 'Connecting...') : 'Stopped'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowWorkers(!showWorkers)}
            className={`px-2 py-1 text-[10px] rounded transition-colors ${showWorkers ? 'bg-gray-700 text-gray-200' : 'text-gray-500 hover:text-gray-400'}`}
          >
            Workers
          </button>
          {!kingRunning && (
            <button
              onClick={handleStartKing}
              disabled={startingKing}
              className="px-2 py-1 text-[10px] text-green-400 hover:text-green-300 transition-colors disabled:opacity-50"
            >
              {startingKing ? 'Starting...' : 'Start'}
            </button>
          )}
          {kingRunning && (
            <button
              onClick={handleStopKing}
              className="px-2 py-1 text-[10px] text-red-400 hover:text-red-300 transition-colors"
            >
              Stop
            </button>
          )}
        </div>
      </div>

      {/* Team overview */}
      <TeamOverview onAgentClick={onAgentClick} />

      {/* Workers panel (collapsible sidebar) */}
      {showWorkers && (
        <div className="absolute right-0 top-20 w-72 h-[calc(100%-10rem)] bg-gray-900 border-l border-gray-800 p-4 overflow-y-auto z-10">
          <WorkersPanel />
        </div>
      )}

      {/* Terminal View */}
      <div className="flex-1 overflow-hidden">
        {kingRunning ? (
          <AgentTerminal
            sessionName={KING_SESSION_NAME}
            readOnly={false}
            onConnectionChange={handleConnectionChange}
          />
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="text-center max-w-md">
              <span className="text-4xl">&#128081;</span>
              <h3 className="mt-4 text-lg font-medium text-amber-400">
                Welcome to King Mode
              </h3>
              <p className="mt-2 text-sm text-gray-500">
                Tell me what you want to build. I'll create and manage a team of AI agents to accomplish your goal.
              </p>
              <div className="mt-6 space-y-2 text-[11px] text-gray-600 text-left">
                <p className="flex items-center gap-2">
                  <span className="text-green-500">&#8226;</span>
                  "Build a REST API for user authentication"
                </p>
                <p className="flex items-center gap-2">
                  <span className="text-blue-500">&#8226;</span>
                  "Refactor the payment module and add tests"
                </p>
                <p className="flex items-center gap-2">
                  <span className="text-purple-500">&#8226;</span>
                  "Review the codebase for security issues"
                </p>
              </div>
              <button
                onClick={handleStartKing}
                disabled={startingKing}
                className="mt-6 px-4 py-2 bg-amber-500 text-gray-900 rounded-lg font-medium text-sm hover:bg-amber-400 transition-colors disabled:opacity-50"
              >
                {startingKing ? 'Starting King...' : 'Start King'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Note: KingQuestionPanel and KingMessageBubble removed - terminal shows Claude's native UI
