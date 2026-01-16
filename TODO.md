# TODO

## Completed: v1 - Agent Fundamentals

### v0_minimal.py (66 lines)
- [x] Basic agent loop
- [x] Bash tool only
- [x] Prove the concept works

### v1_basic.py (213 lines)
- [x] Add read, write, edit tools
- [x] Proper error handling
- [x] System prompt

### v2_todo.py (308 lines)
- [x] Add todo tools (add/update/list)
- [x] Agent can track its own tasks
- [x] Progress display per turn

### v3_subagent.py (423 lines)
- [x] Add task tool for spawning child agents
- [x] Isolated context per subagent
- [x] Subagent tracking and status

---

## Completed: v2 - Orchestrator

### Go Orchestrator
- [x] Project setup (go.mod)
- [x] Agent process manager (spawn/kill processes)
- [x] Track PID, status, tokens per agent
- [x] Environment passthrough (ANTHROPIC_API_KEY)
- [x] REST API endpoints
- [x] WebSocket event bus

### Rust Stream Parser
- [x] Parse Python agent format (JSON + plain text)
- [x] Parse Claude Code stream-json format
- [x] Normalize both to unified events
- [x] Unit tests

---

## Completed: v3 - 2D Dashboard

### React + Vite + Tailwind
- [x] Project setup
- [x] Zustand state management
- [x] WebSocket connection hook

### Components
- [x] Header with stats
- [x] AgentList sidebar
- [x] AgentCard with status
- [x] SpawnDialog (Python + Claude Code)
- [x] EventLog stream

### Tested
- [x] Spawn agents from UI
- [x] View agent list
- [x] See agent status updates

---

## Current Focus: v4 - 3D Visualization

### Setup
- [ ] Install React Three Fiber + drei
- [ ] Create 3D scene with isometric camera

### Scene Elements
- [ ] Floor/ground plane
- [ ] Agent avatars (3D characters)
- [ ] Zone areas
- [ ] Connection lines (parent/child)

### Interactions
- [ ] Click agent to select
- [ ] Floating UI panels
- [ ] Smooth animations

---

## Later

- [ ] v5: Persistence layer
- [ ] Polish: Landing page, docs, branding
