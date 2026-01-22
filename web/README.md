# MissionControl Web UI

React-based dashboard for MissionControl agent orchestration.

## Architecture

```mermaid
flowchart TB
    subgraph Components["React Components"]
        App[App.tsx]
        KP[KingPanel]
        AC[AgentCard]
        ZG[ZoneGroup]
        PW[ProjectWizard]
        WM[WorkflowMatrix]
        ST[Settings]
    end

    subgraph State["Zustand Stores"]
        US[useStore<br/>Main app state]
        MS[useMissionStore<br/>V5 mission state]
        WFS[useWorkflowStore<br/>Workflow phases]
        KS[useKnowledgeStore<br/>Token management]
    end

    subgraph Hooks["Custom Hooks"]
        WH[useWebSocket]
        KH[useKeyboardShortcuts]
    end

    subgraph Services["Services"]
        WS[WebSocket Client]
        HTTP[HTTP API Client]
    end

    App --> KP & AC & ZG & PW & WM & ST
    KP --> US & MS
    AC --> US
    ZG --> US
    WM --> WFS
    
    WH --> WS
    WH --> US & MS
    HTTP --> US
```

## Component Hierarchy

```mermaid
graph TD
    App --> Layout
    Layout --> Sidebar
    Layout --> MainContent
    
    Sidebar --> ZoneList
    Sidebar --> AgentList
    Sidebar --> Navigation
    
    MainContent --> KingChat
    MainContent --> WorkflowView
    MainContent --> SettingsPanel
    
    KingChat --> MessageList
    KingChat --> InputArea
    KingChat --> StatusIndicator
    
    WorkflowView --> PhaseTracker
    WorkflowView --> TaskList
    WorkflowView --> GateDialog
    
    AgentList --> AgentCard
    AgentCard --> TokenDisplay
    AgentCard --> StatusBadge
```

## State Management

```mermaid
flowchart LR
    subgraph Zustand["Zustand Stores"]
        direction TB
        A[useStore]
        B[useMissionStore]
        C[useWorkflowStore]
        D[useKnowledgeStore]
    end

    subgraph useStore["Main Store"]
        agents[agents: Agent[]]
        zones[zones: Zone[]]
        messages[messages: Message[]]
        connection[connectionStatus]
    end

    subgraph useMissionStore["Mission Store"]
        phase[currentPhase]
        tasks[tasks: Task[]]
        workers[workers: Worker[]]
        gates[gates: Gate[]]
        findings[findings]
    end

    subgraph useWorkflowStore["Workflow Store"]
        personas[personas: Persona[]]
        enabled[enabledPersonas]
        matrix[workflowMatrix]
    end

    A --> useStore
    B --> useMissionStore
    C --> useWorkflowStore
```

## WebSocket Event Handling

```mermaid
sequenceDiagram
    participant Server as Go Bridge
    participant WS as WebSocket
    participant Hook as useWebSocket
    participant Store as Zustand Store
    participant UI as Components

    Server->>WS: Event message
    WS->>Hook: onmessage
    Hook->>Hook: Parse JSON
    Hook->>Hook: Switch on event.type
    
    alt agent_spawned
        Hook->>Store: addAgent(agent)
    else agent_stopped
        Hook->>Store: updateAgent(id, status)
    else phase_changed
        Hook->>Store: setPhase(phase)
    else task_created
        Hook->>Store: addTask(task)
    else findings_ready
        Hook->>Store: setFindings(taskId, data)
    end
    
    Store-->>UI: Re-render
```

### Handled Event Types

```mermaid
graph TD
    subgraph AgentEvents["Agent Events"]
        A1[agent_list]
        A2[agent_spawned]
        A3[agent_status]
        A4[agent_stopped]
        A5[agent_killed]
        A6[agent_attention]
        A7[tokens_updated]
    end

    subgraph MissionEvents["Mission Events"]
        M1[mission_state]
        M2[phase_changed]
        M3[task_created]
        M4[task_updated]
        M5[worker_spawned]
        M6[worker_completed]
        M7[findings_ready]
        M8[gate_ready]
        M9[gate_approved]
    end

    subgraph KingEvents["King Events"]
        K1[king_status]
        K2[king_output]
        K3[king_response]
    end

    subgraph ZoneEvents["Zone Events"]
        Z1[zone_created]
        Z2[zone_updated]
        Z3[zone_deleted]
        Z4[zone_list]
    end
```

## Key Components

### KingChat

```mermaid
stateDiagram-v2
    [*] --> Disconnected
    Disconnected --> Connecting : Start King
    Connecting --> Connected : WebSocket open
    Connected --> Chatting : Ready
    Chatting --> WaitingResponse : Send message
    WaitingResponse --> Chatting : Receive response
    Chatting --> Disconnected : Stop King
    Connected --> Disconnected : Error
```

### WorkflowMatrix

Shows persona availability per phase:

```mermaid
graph LR
    subgraph Idea
        R[Researcher ✓]
    end

    subgraph Design
        D[Designer ✓]
        A[Architect ✓]
    end

    subgraph Implement
        DEV[Developer ✓]
        DBG[Debugger ✓]
    end

    subgraph Verify
        REV[Reviewer ✓]
        SEC[Security ○]
        TST[Tester ✓]
        QA[QA ○]
    end

    subgraph Document
        DOC[Docs ✓]
    end

    subgraph Release
        OPS[DevOps ○]
    end
```

### AgentCard

```mermaid
graph TD
    Card[AgentCard]
    Card --> Header[Header: Name + Status]
    Card --> Body[Body: Zone + Task]
    Card --> Footer[Footer: Tokens + Actions]
    
    Header --> StatusBadge
    Body --> ZoneTag
    Body --> TaskDescription
    Footer --> TokenCount
    Footer --> KillButton
```

## Development

```bash
# Install dependencies
npm install

# Start dev server (connects to orchestrator at localhost:8080)
npm run dev

# Run tests
npm test

# Run E2E tests (requires running orchestrator)
npm run test:e2e

# Build for production
npm run build

# Lint
npm run lint
```

## Testing Strategy

```mermaid
pie title Test Coverage
    "Unit Tests (Vitest)" : 81
    "E2E Tests (Playwright)" : 10
    "Type Tests" : 49
```

### Unit Tests

```bash
npm test
npm run test:coverage
```

### E2E Tests

```bash
# Start backend first
cd .. && make dev

# Run E2E tests
npm run test:e2e
```

## File Structure

```mermaid
graph TD
    WEB[web/]
    WEB --> SRC[src/]
    WEB --> E2E[e2e/]
    WEB --> PUBLIC[public/]

    SRC --> COMP[components/]
    SRC --> HOOKS[hooks/]
    SRC --> STORES[stores/]
    SRC --> TYPES[types/]
    SRC --> UTILS[utils/]

    COMP --> KING[KingChat/]
    COMP --> AGENTS[AgentCard/]
    COMP --> ZONES[ZoneGroup/]
    COMP --> WORKFLOW[WorkflowMatrix/]
    COMP --> SETTINGS[Settings/]

    HOOKS --> WS[useWebSocket.ts]
    HOOKS --> KB[useKeyboardShortcuts.ts]

    STORES --> MAIN[useStore.ts]
    STORES --> MISSION[useMissionStore.ts]
    STORES --> WFLOW[useWorkflowStore.ts]
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `⌘N` | Spawn agent |
| `⌘K` | Kill agent |
| `⌘⇧K` | Toggle King mode |
| `⌘,` | Open settings |
| `⌘/` | Show shortcuts |
| `Escape` | Close dialogs |

## API Integration

```mermaid
sequenceDiagram
    participant UI as React Component
    participant Hook as Custom Hook
    participant API as HTTP Client
    participant Backend as Go Bridge

    UI->>Hook: Call action
    Hook->>API: HTTP request
    API->>Backend: REST endpoint
    Backend-->>API: Response
    API-->>Hook: Data
    Hook-->>UI: Update state
```

### Endpoints Used

| Method | Endpoint | Component |
|--------|----------|-----------|
| POST | /api/agents | SpawnDialog |
| DELETE | /api/agents/:id | AgentCard |
| POST | /api/king/start | KingPanel |
| POST | /api/king/stop | KingPanel |
| POST | /api/king/message | KingChat |
| GET | /api/zones | ZoneList |
| POST | /api/mission/gates/:phase/approve | GateDialog |

## Build Configuration

- **Framework**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS
- **State**: Zustand
- **Testing**: Vitest + Playwright
- **Linting**: ESLint + Prettier