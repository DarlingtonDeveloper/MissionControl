import { useState, useEffect } from 'react'
import { Modal } from './Modal'
import { Spinner } from './Spinner'
import { browseDirectory } from '../stores/useProjectStore'
import type { DirEntry } from '../types/project'

interface FolderPickerProps {
  open: boolean
  onClose: () => void
  onSelect: (path: string) => void
  initialPath?: string
}

export function FolderPicker({ open, onClose, onSelect, initialPath }: FolderPickerProps) {
  const [currentPath, setCurrentPath] = useState('')
  const [entries, setEntries] = useState<DirEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Load directory on open or path change
  useEffect(() => {
    if (!open) return

    const loadDirectory = async (path?: string) => {
      setLoading(true)
      setError('')
      try {
        const result = await browseDirectory(path)
        setCurrentPath(result.path)
        setEntries(result.entries)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load directory')
      } finally {
        setLoading(false)
      }
    }

    loadDirectory(initialPath || undefined)
  }, [open, initialPath])

  const navigateTo = async (path: string) => {
    setLoading(true)
    setError('')
    try {
      const result = await browseDirectory(path)
      setCurrentPath(result.path)
      setEntries(result.entries)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load directory')
    } finally {
      setLoading(false)
    }
  }

  const navigateUp = () => {
    const parentPath = currentPath.split('/').slice(0, -1).join('/') || '/'
    navigateTo(parentPath)
  }

  const handleSelect = () => {
    onSelect(currentPath)
    onClose()
  }

  // Parse path into breadcrumb segments
  const pathSegments = currentPath.split('/').filter(Boolean)

  return (
    <Modal open={open} onClose={onClose} title="Select Folder" width="lg">
      <div className="space-y-4">
        {/* Current path breadcrumbs */}
        <div className="flex items-center gap-1 text-xs text-gray-400 overflow-x-auto pb-1">
          <button
            onClick={() => navigateTo('/')}
            className="hover:text-gray-200 transition-colors shrink-0"
          >
            /
          </button>
          {pathSegments.map((segment, index) => {
            const segmentPath = '/' + pathSegments.slice(0, index + 1).join('/')
            return (
              <span key={segmentPath} className="flex items-center gap-1 shrink-0">
                <span className="text-gray-600">/</span>
                <button
                  onClick={() => navigateTo(segmentPath)}
                  className="hover:text-gray-200 transition-colors"
                >
                  {segment}
                </button>
              </span>
            )
          })}
        </div>

        {/* Error message */}
        {error && (
          <div className="px-3 py-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded">
            {error}
          </div>
        )}

        {/* Directory listing */}
        <div className="h-64 overflow-y-auto border border-gray-700/50 rounded bg-gray-800/50">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Spinner />
            </div>
          ) : (
            <div className="divide-y divide-gray-700/30">
              {/* Parent directory */}
              {currentPath !== '/' && (
                <button
                  onClick={navigateUp}
                  className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-gray-700/50 transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                  <span className="text-gray-500">..</span>
                </button>
              )}

              {/* Directory entries */}
              {entries.length === 0 && !loading && (
                <div className="px-3 py-8 text-center text-sm text-gray-500">
                  No subdirectories
                </div>
              )}
              {entries.map((entry) => (
                <button
                  key={entry.name}
                  onClick={() => navigateTo(`${currentPath}/${entry.name}`)}
                  className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-gray-700/50 transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                  {entry.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Selected path display */}
        <div className="px-3 py-2 text-xs font-mono text-gray-400 bg-gray-800 rounded border border-gray-700/50 truncate">
          {currentPath}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 text-sm text-gray-400 bg-gray-800 hover:bg-gray-700 rounded transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSelect}
            disabled={loading}
            className="flex-1 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed rounded transition-colors"
          >
            Select Folder
          </button>
        </div>
      </div>
    </Modal>
  )
}
