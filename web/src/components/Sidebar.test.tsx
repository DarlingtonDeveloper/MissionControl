import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { Sidebar } from './Sidebar'
import { useStore } from '../stores/useStore'
import { useProjectStore } from '../stores/useProjectStore'
import type { Project } from '../types/project'

describe('Sidebar', () => {
  const mockProjects: Project[] = [
    { path: '/project/one', name: 'Project One', lastOpened: '2024-01-01T00:00:00Z' },
    { path: '/project/two', name: 'Project Two', lastOpened: '2024-01-02T00:00:00Z' }
  ]

  beforeEach(() => {
    // Reset stores
    useStore.setState({
      zones: [],
      agents: [],
      kingMode: false
    })
    useProjectStore.setState({
      projects: [],
      currentProject: null,
      wizardOpen: false
    })
    vi.clearAllMocks()
  })

  describe('Project List', () => {
    it('should show "Create a project" when no projects exist', () => {
      render(<Sidebar />)

      expect(screen.getByText('Create a project')).toBeInTheDocument()
    })

    it('should display current project name', () => {
      act(() => {
        useProjectStore.setState({
          projects: mockProjects,
          currentProject: '/project/one'
        })
      })

      render(<Sidebar />)

      expect(screen.getByText('Project One')).toBeInTheDocument()
    })

    it('should list other projects when multiple exist', () => {
      act(() => {
        useProjectStore.setState({
          projects: mockProjects,
          currentProject: '/project/one'
        })
      })

      render(<Sidebar />)

      // Project One should be displayed as current
      expect(screen.getByText('Project One')).toBeInTheDocument()
      // Project Two should be in the list
      expect(screen.getByText('Project Two')).toBeInTheDocument()
    })

    it('should switch projects on click', () => {
      const setCurrentProject = vi.fn()

      act(() => {
        useProjectStore.setState({
          projects: mockProjects,
          currentProject: '/project/one',
          setCurrentProject
        })
      })

      render(<Sidebar />)

      // Click on Project Two to switch
      const projectTwoButton = screen.getByText('Project Two')
      fireEvent.click(projectTwoButton)

      expect(setCurrentProject).toHaveBeenCalledWith('/project/two')
    })

    it('should open wizard on + button click', () => {
      const openWizard = vi.fn()

      act(() => {
        useProjectStore.setState({
          projects: [],
          currentProject: null,
          openWizard
        })
      })

      render(<Sidebar />)

      // Click the + button
      const addButton = screen.getByTitle('New project')
      fireEvent.click(addButton)

      expect(openWizard).toHaveBeenCalled()
    })

    it('should open wizard when clicking "Create a project"', () => {
      const openWizard = vi.fn()

      act(() => {
        useProjectStore.setState({
          projects: [],
          currentProject: null,
          openWizard
        })
      })

      render(<Sidebar />)

      const createButton = screen.getByText('Create a project')
      fireEvent.click(createButton)

      expect(openWizard).toHaveBeenCalled()
    })
  })

  describe('King Mode', () => {
    it('should show King indicator when kingMode is active', () => {
      act(() => {
        useStore.setState({ kingMode: true })
      })

      render(<Sidebar />)

      expect(screen.getByText('King is managing agents')).toBeInTheDocument()
    })

    it('should not show King indicator when kingMode is inactive', () => {
      act(() => {
        useStore.setState({ kingMode: false })
      })

      render(<Sidebar />)

      expect(screen.queryByText('King is managing agents')).not.toBeInTheDocument()
    })
  })

  describe('Zones', () => {
    it('should show "No zones created" when zones are empty', () => {
      act(() => {
        useStore.setState({ zones: [] })
      })

      render(<Sidebar />)

      expect(screen.getByText('No zones created')).toBeInTheDocument()
    })

    it('should show "Create a zone" button when no zones', () => {
      const onNewZone = vi.fn()

      act(() => {
        useStore.setState({ zones: [] })
      })

      render(<Sidebar onNewZone={onNewZone} />)

      const createZoneButton = screen.getByText('Create a zone')
      fireEvent.click(createZoneButton)

      expect(onNewZone).toHaveBeenCalled()
    })

    it('should render zones when they exist', () => {
      act(() => {
        useStore.setState({
          zones: [
            { id: 'zone-1', name: 'Frontend', color: 'blue', agentLimit: 5 },
            { id: 'zone-2', name: 'Backend', color: 'green', agentLimit: 5 }
          ]
        })
      })

      render(<Sidebar />)

      // The zones should be rendered via ZoneGroup component
      expect(screen.queryByText('No zones created')).not.toBeInTheDocument()
    })
  })

  describe('Footer', () => {
    it('should show keyboard shortcuts', () => {
      render(<Sidebar />)

      // The keyboard shortcuts are in a single string: "⌘N spawn · ⌘⇧N zone"
      expect(screen.getByText(/⌘N spawn/)).toBeInTheDocument()
    })
  })

  describe('Projects Section Header', () => {
    it('should render Projects section header', () => {
      render(<Sidebar />)

      expect(screen.getByText('Projects')).toBeInTheDocument()
    })
  })
})
