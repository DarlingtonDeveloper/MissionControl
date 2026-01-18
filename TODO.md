# MissionControl — TODO

## Getting Started (v5)

1. Read V5-IMPLEMENTATION.md for detailed specs
2. Start with `mc init` command - it's the foundation
3. Reference V4-RUST-CONTRACTS.md for Rust structs
4. Reference PERSONAS-SPEC.md for persona details

## Completed

### v1: Agent Fundamentals ✅
- [x] v0_minimal.py (~50 lines, bash only)
- [x] v1_basic.py (~200 lines, full tools)
- [x] v2_todo.py (~300 lines, explicit planning)
- [x] v3_subagent.py (~450 lines, child agents)

### v2: Orchestrator ✅
- [x] Go process manager (spawn/kill agents)
- [x] REST API endpoints
- [x] WebSocket event hub
- [x] Rust stream parser

### v3: 2D Dashboard ✅
- [x] Zustand state + persistence
- [x] Header, Sidebar, AgentCard, AgentPanel
- [x] Zone System (CRUD, split/merge)
- [x] Persona System (defaults + custom)
- [x] King Mode UI (KingPanel, KingHeader)
- [x] Attention System (notifications)
- [x] Settings Panel + keyboard shortcuts
- [x] 81 unit tests

### v4: Rust Core ✅
- [x] Workflow engine (phases, gates, tasks)
- [x] Knowledge manager (tokens, checkpoints, validation)
- [x] Health monitor (stuck detection)
- [x] Struct definitions and logic

---

## Current: v5 — King + mc CLI

The brain of MissionControl. Make King actually orchestrate.

### Phase 1: mc CLI Foundation ✅

```
mc
├── init       # Create .mission/ scaffold
├── spawn      # Spawn worker process
├── kill       # Kill worker process
├── status     # JSON dump of state
├── workers    # List active workers
├── handoff    # Validate and store handoff
├── gate       # Check/approve gates
├── phase      # Get/set phase
├── task       # CRUD for tasks
└── serve      # Start Go bridge + UI
```

**DONE:**
- [x] Create cmd/mc/ with cobra
- [x] `mc init` - Create .mission/ directory structure
- [x] `mc status` - Read and dump .mission/state/*.json
- [x] `mc phase` - Get current phase
- [x] `mc phase next` - Transition phase
- [x] `mc task create <name> --phase <p> --zone <z> --persona <p>`
- [x] `mc task list [--phase <p>]`
- [x] `mc task update <id> --status <s>`
- [x] `mc workers` - List active workers from state
- [x] `mc spawn <persona> <task> --zone <zone>` - Spawn Claude Code process
- [x] `mc kill <worker-id>` - Kill worker process
- [x] `mc handoff <file>` - Validate JSON, store in .mission/
- [x] `mc gate check <phase>` - Check gate criteria
- [x] `mc gate approve <phase>` - Approve and transition
- [ ] `mc serve` - Start Go bridge (WebSocket + file watcher)

### Phase 2: .mission/ Structure ✅

**DONE:**
- [x] Define JSON schemas for state files
- [x] Template for CLAUDE.md (King prompt)
- [x] Templates for worker prompts (11 personas)
- [x] `mc init` creates full structure

**.mission/ layout:**
```
.mission/
├── CLAUDE.md              # King system prompt
├── config.json            # Project settings
├── state/
│   ├── phase.json
│   ├── tasks.json
│   ├── workers.json
│   └── gates.json
├── specs/
├── findings/
├── handoffs/
├── checkpoints/
└── prompts/
    ├── researcher.md
    ├── designer.md
    ├── developer.md
    └── ... (11 total)
```

### Phase 3: King CLAUDE.md ✅

**DONE:**
- [x] Write King system prompt (~100 lines)
- [x] Document available mc commands
- [x] Explain workflow (phases, gates, tasks)
- [x] Define constraints (never code, always delegate)
- [ ] Test King spawning workers via mc

**Key sections:**
- Role and responsibilities
- Available commands (mc spawn, mc task, etc.)
- Workflow explanation
- Constraints (no coding, only coordinating)
- How to read findings and synthesize

### Phase 4: Worker Prompts ✅

**DONE:**
- [x] Researcher prompt (Idea phase)
- [x] Designer prompt (Design phase)
- [x] Architect prompt (Design phase)
- [x] Developer prompt (Implement phase)
- [x] Debugger prompt (Implement phase)
- [x] Reviewer prompt (Verify phase)
- [x] Security prompt (Verify phase)
- [x] Tester prompt (Verify phase)
- [x] QA prompt (Verify phase)
- [x] Docs prompt (Document phase)
- [x] DevOps prompt (Release phase)

**Each prompt includes:**
- Role and focus
- Zone constraint
- Handoff JSON format
- `mc handoff` instruction

### Phase 5: Go Bridge Updates ✅

**DONE:**
- [x] Spawn King as Claude Code process
- [x] Route UI chat to King stdin
- [x] Spawn workers as Claude Code processes
- [x] Relay agent stdout to WebSocket
- [x] File watcher on .mission/state/ → WebSocket events
- [x] REST endpoint: POST /api/mission/gates/:phase/approve

**WebSocket events (implemented):**
```
{ type: "phase_changed", phase: "design" }
{ type: "task_created", task: Task }
{ type: "task_updated", task_id: string, status: string }
{ type: "worker_spawned", worker_id: string, persona: string }
{ type: "worker_completed", worker_id: string }
{ type: "findings_ready", task_id: string }
{ type: "gate_ready", phase: string }
{ type: "gate_approved", phase: string }
{ type: "king_output", data: object }
{ type: "king_status", is_running: boolean }
{ type: "mission_state", state: object }
```

### Phase 6: Rust Integration ✅

**DONE:**
- [x] Create mc-core binary (core/mc-core/)
- [x] `mc-core validate-handoff <file>` - Schema + semantic validation
- [x] `mc-core check-gate <phase>` - Gate criteria evaluation
- [x] `mc-core count-tokens <file>` - Token counting
- [x] mc CLI calls mc-core for validation (`mc handoff --rust`)

### Phase 7: React UI Updates ✅

**DONE:**
- [x] Connect King chat to actual King process (useMissionStore)
- [x] Display phase from WebSocket events
- [x] Display tasks from WebSocket events
- [x] Display active workers (WorkersPanel)
- [x] Gate approval dialog (existing GateApproval)
- [x] Findings viewer (FindingsViewer)

### Phase 8: Integration Testing ✅

**DONE:**
- [x] Test: `mc init` creates valid .mission/ (8 Go tests)
- [x] Test: Phase transitions work correctly
- [x] Test: Handoff validation accepts/rejects correctly
- [x] Test: Gate check and approval flow
- [x] Test: Full phase sequence Idea → Release
- [x] Rust tests: 56 tests passing

### Phase 9: Distribution ✅

**DONE:**
- [x] Homebrew formula (homebrew/mission-control.rb)
- [x] Makefile for building releases
- [x] Multi-platform build targets
- [x] README install instructions (pending)

---

## Future: v6 — 3D Visualization

- [ ] React Three Fiber setup
- [ ] Agent avatars in 3D space
- [ ] Zone visualization
- [ ] Camera controls
- [ ] Animations (spawn, complete, handoff)

---

## Future: v7+ — Polish & Scale

- [ ] Persistence (PostgreSQL or SQLite)
- [ ] Multi-model routing (Haiku/Sonnet/Opus)
- [ ] Token budget enforcement
- [ ] Worker health monitoring in UI
- [ ] Dark/light themes
- [ ] Remote access (deploy bridge)
- [ ] Conductor Skill (MissionControl builds MissionControl)

---

## Quick Reference

| Version | Focus | Status |
|---------|-------|--------|
| v1 | Agent fundamentals | ✅ Done |
| v2 | Go orchestrator | ✅ Done |
| v3 | React UI | ✅ Done |
| v4 | Rust core | ✅ Done |
| v5 | King + mc CLI | ✅ Done |
| v6 | 3D visualization | Future |
| v7+ | Polish & scale | Future |

---

## Files to Create (v5)

```
cmd/
└── mc/
    ├── main.go
    ├── init.go
    ├── spawn.go
    ├── kill.go
    ├── status.go
    ├── workers.go
    ├── handoff.go
    ├── gate.go
    ├── phase.go
    ├── task.go
    └── serve.go

templates/
├── CLAUDE.md              # King prompt template
├── config.json            # Default config
└── prompts/
    ├── researcher.md
    ├── designer.md
    ├── developer.md
    ├── debugger.md
    ├── reviewer.md
    ├── security.md
    ├── tester.md
    ├── qa.md
    ├── docs.md
    └── devops.md
```

---

## Notes

**Key insight from Gastown/Claude-Flow:** Don't reinvent Claude Code. The CLI manages state, Claude Code sessions do the orchestration.

**What mc CLI does:**
- State management (CRUD on .mission/ files)
- Process management (spawn/kill Claude Code)
- Validation (calls Rust core)

**What mc CLI does NOT do:**
- LLM API calls
- Orchestration decisions
- Context management