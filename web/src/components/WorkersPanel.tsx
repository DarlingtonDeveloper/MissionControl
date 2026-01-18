import { useMissionWorkers, type MissionWorker } from '../stores/useMissionStore'

const personaColors: Record<string, string> = {
  researcher: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  designer: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  architect: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  developer: 'bg-green-500/20 text-green-400 border-green-500/30',
  debugger: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  reviewer: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  security: 'bg-red-500/20 text-red-400 border-red-500/30',
  tester: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  qa: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
  docs: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  devops: 'bg-pink-500/20 text-pink-400 border-pink-500/30'
}

const statusColors: Record<MissionWorker['status'], string> = {
  starting: 'bg-yellow-500',
  running: 'bg-green-500',
  completed: 'bg-blue-500',
  error: 'bg-red-500'
}

export function WorkersPanel() {
  const workers = useMissionWorkers()

  const activeWorkers = workers.filter((w) => w.status === 'running' || w.status === 'starting')
  const completedWorkers = workers.filter((w) => w.status === 'completed')
  const errorWorkers = workers.filter((w) => w.status === 'error')

  return (
    <div className="space-y-4">
      {/* Active Workers */}
      <div>
        <h4 className="text-xs font-medium text-gray-400 mb-2">
          Active Workers ({activeWorkers.length})
        </h4>
        {activeWorkers.length === 0 ? (
          <div className="text-center py-4 text-gray-500 text-xs">
            No active workers
          </div>
        ) : (
          <div className="space-y-2">
            {activeWorkers.map((worker) => (
              <WorkerCard key={worker.id} worker={worker} />
            ))}
          </div>
        )}
      </div>

      {/* Completed Workers */}
      {completedWorkers.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-gray-400 mb-2">
            Completed ({completedWorkers.length})
          </h4>
          <div className="space-y-2">
            {completedWorkers.slice(0, 5).map((worker) => (
              <WorkerCard key={worker.id} worker={worker} compact />
            ))}
            {completedWorkers.length > 5 && (
              <p className="text-[10px] text-gray-500 text-center">
                +{completedWorkers.length - 5} more
              </p>
            )}
          </div>
        </div>
      )}

      {/* Error Workers */}
      {errorWorkers.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-red-400 mb-2">
            Errors ({errorWorkers.length})
          </h4>
          <div className="space-y-2">
            {errorWorkers.map((worker) => (
              <WorkerCard key={worker.id} worker={worker} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

interface WorkerCardProps {
  worker: MissionWorker
  compact?: boolean
}

function WorkerCard({ worker, compact }: WorkerCardProps) {
  const colorClass = personaColors[worker.persona] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'

  if (compact) {
    return (
      <div className="flex items-center gap-2 px-2 py-1.5 bg-gray-800/50 rounded">
        <div className={`w-1.5 h-1.5 rounded-full ${statusColors[worker.status]}`} />
        <span className="text-[10px] text-gray-400 capitalize">{worker.persona}</span>
        <span className="text-[10px] text-gray-500 truncate flex-1">{worker.taskId}</span>
      </div>
    )
  }

  return (
    <div className={`p-3 rounded-lg border ${colorClass}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${statusColors[worker.status]} ${worker.status === 'running' ? 'animate-pulse' : ''}`} />
          <span className="text-sm font-medium capitalize">{worker.persona}</span>
        </div>
        <span className="text-[10px] text-gray-500">{worker.zone}</span>
      </div>

      <div className="mt-2 space-y-1">
        <p className="text-[10px] text-gray-400 truncate">
          Task: {worker.taskId}
        </p>
        <p className="text-[10px] text-gray-500">
          Started: {new Date(worker.startedAt).toLocaleTimeString()}
        </p>
        {worker.pid && (
          <p className="text-[10px] text-gray-500">
            PID: {worker.pid}
          </p>
        )}
      </div>
    </div>
  )
}
