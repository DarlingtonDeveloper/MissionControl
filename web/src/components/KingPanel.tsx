import { useRef, useEffect, useState } from 'react'
import { useStore } from '../stores/useStore'
import { useMissionStore, startKing, stopKing, sendKingMessage as sendMissionKingMessage } from '../stores/useMissionStore'
import { KingHeader } from './KingHeader'
import { TeamOverview } from './TeamOverview'
import { KingInput } from './KingInput'
import { KingAction } from './KingAction'
import { WorkersPanel } from './WorkersPanel'
import type { KingMessage } from '../types'

interface KingPanelProps {
  onExit: () => void
  onAgentClick?: (agentId: string) => void
}

export function KingPanel({ onExit, onAgentClick }: KingPanelProps) {
  const kingConversation = useStore((s) => s.kingConversation)
  const addKingMessage = useStore((s) => s.addKingMessage)
  const kingRunning = useMissionStore((s) => s.kingRunning)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [startingKing, setStartingKing] = useState(false)
  const [showWorkers, setShowWorkers] = useState(false)

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [kingConversation])

  const handleStartKing = async () => {
    setStartingKing(true)
    try {
      await startKing()
    } catch (err) {
      console.error('Failed to start King:', err)
      addKingMessage({
        role: 'assistant',
        content: `Error starting King: ${err instanceof Error ? err.message : 'Unknown error'}`,
        timestamp: Date.now()
      })
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

  const handleSend = async (content: string) => {
    // Start King if not running
    if (!kingRunning) {
      await handleStartKing()
    }

    // Add user message immediately
    const userMessage: KingMessage = {
      role: 'user',
      content,
      timestamp: Date.now()
    }
    addKingMessage(userMessage)

    // Send to backend
    try {
      await sendMissionKingMessage(content)
    } catch (err) {
      console.error('Failed to send king message:', err)
      // Add error message
      addKingMessage({
        role: 'assistant',
        content: `Error: ${err instanceof Error ? err.message : 'Failed to send message'}`,
        timestamp: Date.now()
      })
    }
  }

  return (
    <div className="flex-1 flex flex-col bg-gray-950">
      {/* Header with status */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <KingHeader onExit={onExit} />
          {/* King status indicator */}
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${kingRunning ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
            <span className="text-[10px] text-gray-500">
              {startingKing ? 'Starting...' : kingRunning ? 'Running' : 'Stopped'}
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

      {/* Conversation */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {kingConversation.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center max-w-md">
              <span className="text-4xl">👑</span>
              <h3 className="mt-4 text-lg font-medium text-amber-400">
                Welcome to King Mode
              </h3>
              <p className="mt-2 text-sm text-gray-500">
                Tell me what you want to build. I'll create and manage a team of AI agents to accomplish your goal.
              </p>
              <div className="mt-6 space-y-2 text-[11px] text-gray-600 text-left">
                <p className="flex items-center gap-2">
                  <span className="text-green-500">•</span>
                  "Build a REST API for user authentication"
                </p>
                <p className="flex items-center gap-2">
                  <span className="text-blue-500">•</span>
                  "Refactor the payment module and add tests"
                </p>
                <p className="flex items-center gap-2">
                  <span className="text-purple-500">•</span>
                  "Review the codebase for security issues"
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {kingConversation.map((message, index) => (
              <KingMessageBubble key={index} message={message} />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <KingInput onSend={handleSend} />
    </div>
  )
}

interface KingMessageBubbleProps {
  message: KingMessage
}

function KingMessageBubble({ message }: KingMessageBubbleProps) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] ${
          isUser
            ? 'bg-amber-500/20 border border-amber-500/30 rounded-lg rounded-br-sm'
            : 'bg-gray-800/80 border border-gray-700/50 rounded-lg rounded-bl-sm'
        }`}
      >
        {/* Thinking (collapsed by default) */}
        {message.thinking && (
          <details className="px-4 pt-3">
            <summary className="text-[10px] text-gray-500 cursor-pointer hover:text-gray-400">
              View thinking...
            </summary>
            <div className="mt-2 text-xs text-gray-500 italic whitespace-pre-wrap">
              {message.thinking}
            </div>
          </details>
        )}

        {/* Content */}
        <div className="px-4 py-3">
          <p className={`text-sm whitespace-pre-wrap ${isUser ? 'text-amber-100' : 'text-gray-200'}`}>
            {message.content}
          </p>
        </div>

        {/* Actions */}
        {message.actions && message.actions.length > 0 && (
          <div className="px-4 pb-3 space-y-2">
            {message.actions.map((action, index) => (
              <KingAction key={index} action={action} />
            ))}
          </div>
        )}

        {/* Timestamp */}
        <div className="px-4 pb-2">
          <span className="text-[10px] text-gray-600">
            {new Date(message.timestamp).toLocaleTimeString()}
          </span>
        </div>
      </div>
    </div>
  )
}
