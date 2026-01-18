import { useEffect, useState } from 'react'
import { useFindings, fetchFindings, type Finding } from '../stores/useMissionStore'

interface FindingsViewerProps {
  taskId?: string
}

export function FindingsViewer({ taskId }: FindingsViewerProps) {
  const findings = useFindings()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Finding['findingType'] | 'all'>('all')

  useEffect(() => {
    const loadFindings = async () => {
      setLoading(true)
      setError(null)
      try {
        await fetchFindings(taskId)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load findings')
      } finally {
        setLoading(false)
      }
    }
    loadFindings()
  }, [taskId])

  const filteredFindings = filter === 'all'
    ? findings
    : findings.filter((f) => f.findingType === filter)

  const typeColors: Record<Finding['findingType'], string> = {
    discovery: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    blocker: 'bg-red-500/20 text-red-400 border-red-500/30',
    decision: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    concern: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
  }

  const typeIcons: Record<Finding['findingType'], string> = {
    discovery: '🔍',
    blocker: '🚫',
    decision: '⚖️',
    concern: '⚠️'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin w-6 h-6 border-2 border-gray-500 border-t-blue-500 rounded-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
        {error}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-300">
          Findings {findings.length > 0 && `(${findings.length})`}
        </h3>

        {/* Filter */}
        <div className="flex items-center gap-1">
          {(['all', 'discovery', 'blocker', 'decision', 'concern'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`
                px-2 py-1 text-[10px] font-medium rounded transition-colors
                ${filter === type
                  ? 'bg-gray-700 text-gray-200'
                  : 'text-gray-500 hover:text-gray-400 hover:bg-gray-800'
                }
              `}
            >
              {type === 'all' ? 'All' : typeIcons[type]}
            </button>
          ))}
        </div>
      </div>

      {/* Findings list */}
      {filteredFindings.length === 0 ? (
        <div className="text-center py-8 text-gray-500 text-sm">
          No findings yet
        </div>
      ) : (
        <div className="space-y-2">
          {filteredFindings.map((finding, index) => (
            <div
              key={`${finding.taskId}-${index}`}
              className={`
                p-3 rounded-lg border
                ${typeColors[finding.findingType]}
              `}
            >
              <div className="flex items-start gap-2">
                <span className="text-sm">{typeIcons[finding.findingType]}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase font-medium opacity-70">
                      {finding.findingType}
                    </span>
                    {finding.severity && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-gray-800/50 rounded">
                        {finding.severity}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm">{finding.summary}</p>
                  {finding.detailsPath && (
                    <p className="mt-1 text-[10px] text-gray-500 truncate">
                      {finding.detailsPath}
                    </p>
                  )}
                  <div className="mt-2 flex items-center gap-2 text-[10px] text-gray-500">
                    <span>Task: {finding.taskId}</span>
                    <span>Worker: {finding.workerId}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
