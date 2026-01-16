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

## Current Focus: v2 - Orchestrator (Python Agents)

### Go Orchestrator
- [ ] Project setup (go.mod)
- [ ] Agent process manager (spawn/kill Python processes)
- [ ] Track PID, status, tokens per agent
- [ ] REST API endpoints
  - [ ] POST /api/agents (spawn)
  - [ ] GET /api/agents (list)
  - [ ] DELETE /api/agents/:id (kill)
  - [ ] POST /api/agents/:id/message
- [ ] WebSocket event bus
  - [ ] Broadcast events to connected UIs
  - [ ] Receive commands from UI

### Rust Stream Parser
- [ ] Project setup (Cargo.toml)
- [ ] Parse Python agent JSON format
- [ ] Token counting (tiktoken-rs)
- [ ] Emit unified JSON events

---

## Up Next: v2.5 - Claude Code Support

### Rust Stream Parser (Extended)
- [ ] Parse Claude Code `stream-json` format
- [ ] Normalize to same unified events as Python agents
- [ ] Handle Claude Code specific events (tool_use, result, etc.)

### Go Orchestrator (Extended)
- [ ] Add `type` field to spawn endpoint (python | claude)
- [ ] Spawn Claude Code with `--output-format stream-json`
- [ ] Route Claude Code stdout through parser

---

## Later

- [ ] v3: 2D Dashboard (React + Tailwind + Zustand)
- [ ] v4: 3D Visualization (React Three Fiber)
- [ ] v5: Persistence layer
