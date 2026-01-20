import { Fragment } from 'react'
import type { Phase } from '../types/workflow'
import type { MatrixCell } from '../types/project'
import { PHASE_PERSONAS, DEFAULT_ZONES } from '../types/project'
import { ALL_PHASES, getPhaseLabel } from '../types/workflow'
import { useStore } from '../stores/useStore'

interface WorkflowMatrixProps {
  cells: MatrixCell[]
  onChange: (cells: MatrixCell[]) => void
  /** If true, respect persona enabled state from settings (grays out disabled personas) */
  respectPersonaSettings?: boolean
}

export function WorkflowMatrix({ cells, onChange, respectPersonaSettings = false }: WorkflowMatrixProps) {
  const zones = DEFAULT_ZONES
  const personas = useStore((s) => s.personas)

  // Check if a persona is enabled in settings
  const isPersonaEnabled = (personaId: string): boolean => {
    if (!respectPersonaSettings) return true
    const persona = personas.find((p) => p.id === personaId)
    return persona?.enabled ?? true
  }

  // Get cell state
  const getCell = (phase: Phase, zone: string, persona: string): boolean => {
    const cell = cells.find(
      (c) => c.phase === phase && c.zone === zone && c.persona === persona
    )
    return cell?.enabled ?? true
  }

  // Toggle single cell (only if persona is enabled in settings)
  const toggleCell = (phase: Phase, zone: string, persona: string) => {
    if (!isPersonaEnabled(persona)) return // Can't toggle disabled personas
    const updated = cells.map((c) => {
      if (c.phase === phase && c.zone === zone && c.persona === persona) {
        return { ...c, enabled: !c.enabled }
      }
      return c
    })
    onChange(updated)
  }

  // Toggle entire phase row (only toggles enabled personas)
  const togglePhase = (phase: Phase) => {
    const phasePersonas = PHASE_PERSONAS[phase].filter(isPersonaEnabled)
    if (phasePersonas.length === 0) return // All personas disabled

    const allEnabled = zones.every((zone) =>
      phasePersonas.every((persona) => getCell(phase, zone, persona))
    )
    const updated = cells.map((c) => {
      if (c.phase === phase && isPersonaEnabled(c.persona)) {
        return { ...c, enabled: !allEnabled }
      }
      return c
    })
    onChange(updated)
  }

  // Toggle entire zone column (only toggles enabled personas)
  const toggleZone = (zone: string) => {
    const allEnabled = ALL_PHASES.every((phase) =>
      PHASE_PERSONAS[phase]
        .filter(isPersonaEnabled)
        .every((persona) => getCell(phase, zone, persona))
    )
    const updated = cells.map((c) => {
      if (c.zone === zone && isPersonaEnabled(c.persona)) {
        return { ...c, enabled: !allEnabled }
      }
      return c
    })
    onChange(updated)
  }

  // Phase header state (all, some, none) - only considers enabled personas
  const getPhaseState = (phase: Phase): 'all' | 'some' | 'none' => {
    const phasePersonas = PHASE_PERSONAS[phase].filter(isPersonaEnabled)
    if (phasePersonas.length === 0) return 'none' // All personas disabled

    const enabledCount = zones.reduce(
      (sum, zone) => sum + phasePersonas.filter((p) => getCell(phase, zone, p)).length,
      0
    )
    const total = zones.length * phasePersonas.length
    if (enabledCount === total) return 'all'
    if (enabledCount === 0) return 'none'
    return 'some'
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr>
            <th className="p-2 text-left text-gray-500 border-b border-gray-700 w-28" />
            {zones.map((zone) => (
              <th
                key={zone}
                onClick={() => toggleZone(zone)}
                className="p-2 text-center text-gray-400 border-b border-gray-700 cursor-pointer hover:bg-gray-800 transition-colors"
              >
                {zone.charAt(0).toUpperCase() + zone.slice(1)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ALL_PHASES.map((phase) => (
            <Fragment key={phase}>
              {/* Phase header row */}
              <tr className="bg-gray-800/50">
                <td
                  colSpan={zones.length + 1}
                  onClick={() => togglePhase(phase)}
                  className="p-2 text-xs font-medium text-gray-300 uppercase cursor-pointer hover:bg-gray-800 transition-colors"
                >
                  <span className="mr-2 inline-block w-4 text-center">
                    {getPhaseState(phase) === 'all'
                      ? '✓'
                      : getPhaseState(phase) === 'some'
                        ? '◐'
                        : '○'}
                  </span>
                  {getPhaseLabel(phase)}
                </td>
              </tr>
              {/* Persona rows within phase */}
              {PHASE_PERSONAS[phase].map((persona) => {
                const personaDisabled = !isPersonaEnabled(persona)
                return (
                  <tr key={persona} className={personaDisabled ? 'opacity-40' : ''}>
                    <td className={`p-2 pl-6 border-b border-gray-800 ${
                      personaDisabled ? 'text-gray-600' : 'text-gray-400'
                    }`}>
                      {persona.charAt(0).toUpperCase() + persona.slice(1)}
                      {personaDisabled && (
                        <span className="ml-2 text-[9px] text-gray-600">(disabled)</span>
                      )}
                    </td>
                    {zones.map((zone) => {
                      const enabled = getCell(phase, zone, persona)
                      return (
                        <td
                          key={`${phase}-${zone}-${persona}`}
                          onClick={() => toggleCell(phase, zone, persona)}
                          className={`p-2 text-center border-b border-gray-800 transition-colors ${
                            personaDisabled
                              ? 'cursor-not-allowed'
                              : 'cursor-pointer hover:bg-gray-800'
                          }`}
                        >
                          <span className={
                            personaDisabled
                              ? 'text-gray-700'
                              : enabled
                                ? 'text-green-500'
                                : 'text-gray-600'
                          }>
                            {enabled && !personaDisabled ? '✓' : '○'}
                          </span>
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </Fragment>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[10px] text-gray-600">
        ✓ = enabled &nbsp; ○ = disabled &nbsp; Click any cell, row header, or column header
        to toggle
      </p>
    </div>
  )
}
