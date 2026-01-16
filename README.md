# Agent Orchestra

A visual multi-agent orchestration system for spawning, monitoring, and coordinating AI agents working on your codebase.

## Agent Types

This orchestrates **two types of agents**:

| Type | What | Why |
|------|------|-----|
| **Python Agents** | Custom agents we built (v0-v3) | Educational, lightweight, full control |
| **Claude Code** | Anthropic's CLI agent | Production power, MCP support, battle-tested |

Both output structured JSON, both appear in the same UI.

## Stack

- **Agents**: Python (custom) + Claude Code CLI
- **Orchestrator**: Go (process management, API, WebSocket)
- **Stream Parser**: Rust (normalizes both agent formats)
- **Web UI**: React + Three.js (2D dashboard → 3D visualization)

## Status

**v1 complete** - Python agent fundamentals
**Current:** v2 - Go orchestrator + Rust parser

See [SPEC.md](SPEC.md) for full specification.
See [TODO.md](TODO.md) for progress.

## Quick Start

### Python Agents (v1)

```bash
cd agents
pip install anthropic
export ANTHROPIC_API_KEY="your-key"

# Minimal agent (bash only)
python3 v0_minimal.py "list files in this directory"

# Full agent (read/write/edit)
python3 v1_basic.py "create a hello world script"

# With task planning
python3 v2_todo.py "build a calculator"

# With subagent delegation
python3 v3_subagent.py "build a todo app with tests"
```

### Claude Code (v2+)

```bash
# Once orchestrator is built:
curl -X POST localhost:8080/api/agents \
  -d '{"type": "claude", "task": "fix the auth bug", "workdir": "/my/repo"}'
```

## Requirements

- Python 3.11+
- `ANTHROPIC_API_KEY` environment variable
- Go 1.21+ (for orchestrator)
- Rust (for stream parser)
- Claude Code CLI (for claude agent type)
