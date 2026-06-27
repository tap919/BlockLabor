# Marathon Session Plugin

A plugin for OverCoat that provides tools for long, uninterrupted coding sessions.

## Features

- **Automatic checkpoints** — Saves session context snapshots at configurable intervals (default: every 30 minutes)
- **Break reminders** — Reminds you to take a break after a configurable duration (default: every 90 minutes)
- **Session statistics** — Track duration, files modified, tokens used, and checkpoints
- **Context continuity** — Pick up exactly where you left off after an interruption

## Commands

| Command | Description |
|---------|-------------|
| `/marathon start [name]` | Begin a new marathon session |
| `/marathon checkpoint [label]` | Save a manual checkpoint |
| `/marathon stats` | Display current session statistics |
| `/marathon break` | Acknowledge a break and reset the reminder timer |
| `/marathon stop` | End the session and generate a summary |

## Usage

```bash
# Start a session named "auth-refactor"
/marathon start auth-refactor

# Save a manual milestone
/marathon checkpoint "finished login flow"

# Check progress
/marathon stats

# Acknowledge a coffee break
/marathon break

# Wrap up
/marathon stop
```

## Configuration

The session manager uses these defaults (adjustable via `overcoat.json`):

| Setting | Default | Description |
|---------|---------|-------------|
| `checkpointIntervalMinutes` | 30 | Auto-checkpoint frequency |
| `breakReminderMinutes` | 90 | Break reminder interval |
| `maxDurationHours` | 8 | Maximum session duration before a warning |

## Session Summaries

When you run `/marathon stop`, a JSON summary is saved to `.overcoat/sessions/`:

```
.overcoat/sessions/auth-refactor-2024-01-15.json
```

```json
{
  "name": "auth-refactor",
  "startedAt": 1700000000000,
  "durationMs": 7200000,
  "checkpoints": 4,
  "totalTokens": 15000,
  "filesModified": ["src/auth.ts", "src/login.ts"],
  "breaksTaken": 2
}
```
