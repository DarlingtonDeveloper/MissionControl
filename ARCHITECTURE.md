# Architecture

MissionControl is a visual multi-agent orchestration system where a **King** agent coordinates **worker** agents through a **6-phase workflow**.

## System Overview

```mermaid
flowchart TB
    subgraph UI["Web UI (React)"]
        KP[King Panel]
        ZL[Zones List]
        AP[Agents Panel]
        SP[Settings Panel]
    end

    subgraph Bridge["Go Bridge"]
        WS[WebSocket Hub]
        KM[King Manager]
        FW[File Watcher]
        REST[REST API]
        CLI[mc CLI]
    end

    subgraph Core["Rust Core (mc-core)"]
        VAL[Handoff Validator]
        TOK[Token Counter]
        GATE[Gate Checker]
    end

    subgraph Agents["Claude Code Sessions"]
        KING[King Agent]
        W1[Worker 1]
        W2[Worker 2]
        W3[Worker N]
    end

    subgraph State[".mission/ Directory"]
        CLAUDE[CLAUDE.md]
        STATE[state/]
        SPECS[specs/]
        FIND[findings/]
        HAND[handoffs/]
    end

    UI <-->|WebSocket| WS
    UI -->|HTTP| REST
    WS --> KM
    KM -->|spawns| KING
    KM -->|spawns| W1
    KM -->|spawns| W2
    KM -->|spawns| W3
    FW -->|watches| STATE
    FW -->|emits events| WS
    CLI --> Core
    KING -->|reads| CLAUDE
    KING -->|calls| CLI
    W1 -->|writes| FIND
    W2 -->|writes| FIND
    W3 -->|writes| FIND
    CLI -->|validates| VAL
    CLI -->|counts| TOK
    CLI -->|checks| GATE
```

**Key insight:** King IS a Claude Code session with a good system prompt. Go bridge spawns processes and relays events — no custom LLM API calls. Rust core handles deterministic operations (validation, token counting) that shouldn't consume LLM tokens.

### What We're NOT Building

| Thing | Why Not |
|-------|---------|
| Custom orchestration loop | Claude Code IS the orchestration |
| LLM API integration in Go | King handles all LLM interaction |
| Agent-to-agent message queue | Workers write findings to files |
| Context compilation service | .mission/ files ARE the context |

### How King Orchestrates

King is a Claude Code session with `.mission/CLAUDE.md` as its system prompt. It orchestrates by:
- Using bash to call `mc spawn`, `mc status`, `mc handoff`, `mc gate`
- Reading/writing `.mission/` files directly (specs, findings, state)
- Leveraging normal Claude Code capabilities (file editing, bash, etc.)

## Key Concepts

### King Agent
The King is the only persistent agent. It talks to you, decides what to build, spawns workers, and approves phase gates. It never implements directly.

### Workers
Workers are ephemeral. They receive a **briefing** (~300 tokens), do their task, output **findings**, and die. This keeps context lean and costs low.

### 6-Phase Workflow

```mermaid
stateDiagram-v2
    [*] --> IDEA
    IDEA --> DESIGN : Gate Approved
    DESIGN --> IMPLEMENT : Gate Approved
    IMPLEMENT --> VERIFY : Gate Approved
    VERIFY --> DOCUMENT : Gate Approved
    DOCUMENT --> RELEASE : Gate Approved
    RELEASE --> [*] : Complete
```

Each phase has a **gate** requiring approval before proceeding.

| Phase | Purpose | Workers | Gate Criteria |
|-------|---------|---------|---------------|
| **Idea** | Research feasibility | Researcher | Spec drafted, feasibility assessed |
| **Design** | UI mockups + system design | Designer, Architect | Mockups + API design approved |
| **Implement** | Build features | Developer, Debugger | Code complete, builds |
| **Verify** | Quality checks | Reviewer, Security, Tester, QA | All checks pass |
| **Document** | README + docs | Docs | Docs complete |
| **Release** | Deploy | DevOps | Deployed, verified |

### Zones

Zones organize the codebase (Frontend, Backend, Database, Infra, Shared). Workers are assigned to zones and stay in their lane.

```mermaid
graph TD
    SYS[System] --> FE[Frontend]
    SYS --> BE[Backend]
    SYS --> DB[Database]
    SYS --> INF[Infra]
    SYS --> SH[Shared]
```

## Directory Structure

```
/
├── cmd/mc/                  # mc CLI
├── orchestrator/            # Go bridge
│   ├── api/
│   │   ├── routes.go        # Route registration
│   │   ├── king.go          # King endpoints
│   │   ├── agents.go        # Agent endpoints
│   │   ├── zones.go         # Zone endpoints
│   │   └── projects.go      # Project/wizard endpoints
│   ├── bridge/
│   │   └── king.go          # King tmux manager
│   ├── core/
│   │   └── client.go        # Rust subprocess wrapper
│   ├── manager/
│   └── ws/
├── core/                    # Rust core
│   ├── workflow/
│   ├── knowledge/
│   ├── ffi/
│   └── README.md
├── web/                     # React UI
├── agents/                  # Python agents (educational)
├── docs/
│   └── archive/             # Historical specs
├── scripts/                 # Dev scripts
├── README.md
├── ARCHITECTURE.md
├── CONTRIBUTING.md
├── CHANGELOG.md
├── TODO.md
└── Makefile
```

## Stack

| Component | Language | Purpose |
|-----------|----------|---------|
| **Agents** | Python | Custom agents, educational |
| **mc CLI** | Go | MissionControl CLI commands |
| **Orchestrator** | Go | Process management, REST, WebSocket |
| **mc-core** | Rust | Validation, token counting, gate checking |
| **Core** | Rust | Workflow engine, knowledge manager |
| **Strategy** | Claude Opus | King agent |
| **Workers** | Claude Sonnet/Haiku | Task execution |
| **UI** | React | Dashboard with Zustand state |

## mc CLI

```mermaid
graph TD
    MC[mc]
    MC --> INIT[init]
    MC --> SPAWN[spawn]
    MC --> KILL[kill]
    MC --> STATUS[status]
    MC --> WORKERS[workers]
    MC --> HANDOFF[handoff]
    MC --> GATE[gate]
    MC --> PHASE[phase]
    MC --> TASK[task]
    MC --> SERVE[serve]
```

| Command | Purpose |
|---------|---------|
| `mc init` | Create .mission/ scaffold |
| `mc spawn <persona> <task> --zone <z>` | Spawn worker process |
| `mc kill <worker-id>` | Kill worker process |
| `mc status` | JSON dump of state |
| `mc workers` | List active workers |
| `mc handoff <file>` | Validate and store handoff |
| `mc gate check <phase>` | Check gate criteria |
| `mc gate approve <phase>` | Approve gate |
| `mc phase` | Get current phase |
| `mc phase next` | Transition to next phase |
| `mc task create <n> --phase <p>` | Create task |
| `mc task list` | List tasks |
| `mc task update <id> --status <s>` | Update task status |
| `mc serve` | Start Go bridge + UI |

## mc-core (Rust)

```bash
mc-core validate-handoff <file>   # Schema + semantic validation
mc-core check-gate <phase>        # Gate criteria evaluation
mc-core count-tokens <file>       # Fast token counting with tiktoken
```

## API Endpoints

### Agents
```
POST   /api/agents              # Spawn agent
GET    /api/agents              # List agents
DELETE /api/agents/:id          # Kill agent
POST   /api/agents/:id/message  # Send message
POST   /api/agents/:id/respond  # Respond to attention
```

### Zones
```
POST   /api/zones               # Create zone
GET    /api/zones               # List zones
PUT    /api/zones/:id           # Update zone
DELETE /api/zones/:id           # Delete zone
```

### King
```
POST   /api/king/start          # Start King process
POST   /api/king/stop           # Stop King process
GET    /api/king/status         # Check if King is running
POST   /api/king/message        # Send message to King
```

### Mission Gates
```
GET    /api/mission/gates/:phase          # Check gate status
POST   /api/mission/gates/:phase/approve  # Approve gate
```

### WebSocket Events

```mermaid
flowchart LR
    subgraph Sources["Event Sources"]
        FW[File Watcher]
        KP[King Process]
        API[REST API]
    end

    subgraph Hub["WebSocket Hub"]
        BC[Broadcast]
    end

    subgraph Clients["React UI"]
        C1[Client 1]
        C2[Client N]
    end

    FW & KP & API --> BC --> C1 & C2
```

| Event | Description |
|-------|-------------|
| `mission_state` | Initial state sync |
| `king_status` | King running status |
| `phase_changed` | Phase transitioned |
| `task_created` | New task created |
| `task_updated` | Task status changed |
| `worker_spawned` | Worker started |
| `worker_completed` | Worker finished |
| `gate_ready` | Gate criteria met |
| `gate_approved` | Gate approved |
| `findings_ready` | New findings available |
| `king_output` | King process output |
| `king_error` | King process error |

## Worker Communication (Handoffs)

Workers don't communicate directly. They output structured JSON handoffs:

```mermaid
sequenceDiagram
    participant Worker
    participant CLI as mc CLI
    participant Core as mc-core
    participant State as .mission/
    participant Bridge as Go Bridge
    participant King

    Worker->>Worker: Complete task
    Worker->>Worker: Output JSON to stdout
    Worker->>CLI: mc handoff findings.json
    CLI->>Core: validate-handoff
    Core-->>CLI: Valid/Invalid
    
    alt Invalid
        CLI-->>Worker: Error
        Worker->>Worker: Retry
    else Valid
        CLI->>State: Store in handoffs/
        CLI->>State: Compress to findings/
        CLI->>State: Update tasks.json
        State-->>Bridge: File change detected
        Bridge-->>King: findings_ready event
        King->>State: Read findings
        King->>King: Synthesize, decide next
    end
```

This keeps workers isolated and context lean. No message passing, no shared memory — just files.

## Worker Personas

```mermaid
graph TB
    subgraph Models["Model Tiers (Future: Auto-routing)"]
        direction LR
        OPUS[("Opus<br/>Strategy & Synthesis")]
        SONNET[("Sonnet<br/>Complex Tasks")]
        HAIKU[("Haiku<br/>Simple Tasks")]
    end

    subgraph Personas["11 Worker Personas"]
        subgraph Idea
            R[Researcher]
        end
        subgraph Design
            D[Designer]
            A[Architect]
        end
        subgraph Implement
            DEV[Developer]
            DBG[Debugger]
        end
        subgraph Verify
            REV[Reviewer]
            SEC[Security]
            TST[Tester]
            QA[QA]
        end
        subgraph Document
            DOC[Docs]
        end
        subgraph Release
            OPS[DevOps]
        end
    end

    OPUS -.->|King only| KING[King Agent]
    SONNET --> R & D & A & DEV & DBG & SEC
    HAIKU --> REV & TST & QA & DOC & OPS
```

| Persona | Phase | Model | Purpose |
|---------|-------|-------|---------|
| **King** | All | **Opus** | Strategy, synthesis, user conversation |
| Researcher | Idea | Sonnet | Feasibility research |
| Designer | Design | Sonnet | UI mockups |
| Architect | Design | Sonnet | System design |
| Developer | Implement | Sonnet | Build features |
| Debugger | Implement | Sonnet | Fix issues |
| Reviewer | Verify | Haiku | Code review |
| Security | Verify | Sonnet | Vulnerability check |
| Tester | Verify | Haiku | Write tests |
| QA | Verify | Haiku | E2E validation |
| Docs | Document | Haiku | Documentation |
| DevOps | Release | Haiku | Deployment |

### Model Routing Strategy

**Current:** All workers use their assigned model tier.

**Future (v7):** Smart routing based on task complexity:
- **Opus** — King agent, complex synthesis, strategic decisions
- **Sonnet** — Creative work, complex implementation, security analysis
- **Haiku** — Routine checks, simple tests, documentation, reviews

Cost optimization: Route simple tasks to Haiku, escalate to Sonnet/Opus only when needed.

## .mission/ Directory

Each project has a `.mission/` directory containing all state:

```mermaid
graph TD
    MISSION[.mission/]
    
    MISSION --> CLAUDE[CLAUDE.md<br/>King system prompt]
    MISSION --> CONFIG[config.json<br/>Project settings]
    
    MISSION --> STATE[state/]
    STATE --> PHASE[phase.json]
    STATE --> TASKS[tasks.json]
    STATE --> WORKERS[workers.json]
    STATE --> GATES[gates.json]
    
    MISSION --> SPECS[specs/<br/>Design documents]
    MISSION --> FINDINGS[findings/<br/>Compressed worker output]
    MISSION --> HANDOFFS[handoffs/<br/>Raw handoff JSONs]
    MISSION --> CHECKPOINTS[checkpoints/<br/>State snapshots]
    
    MISSION --> PROMPTS[prompts/]
    PROMPTS --> P1[researcher.md]
    PROMPTS --> P2[designer.md]
    PROMPTS --> P3[architect.md]
    PROMPTS --> P4[developer.md]
    PROMPTS --> P5[... 11 total]
```

```
.mission/
├── CLAUDE.md              # King system prompt
├── config.json            # Project settings (zones, personas)
├── state/
│   ├── phase.json         # Current workflow phase
│   ├── tasks.json         # Task list with status
│   ├── workers.json       # Active worker processes
│   └── gates.json         # Gate approval status
├── specs/                 # Design documents, requirements
├── findings/              # Worker output (research, reviews, etc.)
├── handoffs/              # Validated worker handoff JSONs
├── checkpoints/           # State snapshots for recovery
└── prompts/
    ├── researcher.md
    ├── designer.md
    ├── architect.md
    ├── developer.md
    ├── debugger.md
    ├── reviewer.md
    ├── security.md
    ├── tester.md
    ├── qa.md
    ├── docs.md
    └── devops.md
```

## Configuration

Global configuration is stored at `~/.mission-control/config.json`:

```json
{
  "projects": [
    {
      "path": "/Users/mike/projects/myapp",
      "name": "myapp",
      "lastOpened": "2026-01-19T10:00:00Z"
    }
  ],
  "lastProject": "/Users/mike/projects/myapp",
  "preferences": {
    "theme": "dark"
  }
}
```

Project-specific configuration lives in `.mission/config.json`.

## Design Rationale

**Why King + Workers?**
- King maintains continuity with user
- Workers are disposable, context stays lean
- Handoffs are cheap: spawn fresh vs accumulate

**Why Rust Core?**
- Deterministic logic shouldn't use LLM tokens
- Token counting needs to be fast and accurate
- Validation should be strict (JSON schemas)

**Why 6 Phases?**
- Prevents rushing to implementation
- Gates force quality checks
- Each phase has clear entry/exit criteria

**Why File-Based State?**
- Claude Code reads/writes files naturally
- No complex IPC or message passing
- Easy to inspect and debug
- Checkpoints are just file copies