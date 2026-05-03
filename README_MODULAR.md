# Haybu Modular System

Haybu supports **edge-agent modules** — optional plugins that extend heartbeat payloads with additional metrics. The system is designed to be modular across all three layers: edge agent, API, and web.

---

## Module Contract

A module is a self-contained unit with:

| Field | Description |
|-------|-------------|
| `name` | Unique module identifier (kebab-case) |
| `version` | Semver string |
| `description` | Human-readable description |
| `config_schema` | JSON schema for module configuration |
| `supported_metrics` | List of metric keys the module produces |
| `requires_binary` | (Optional) Name of required system binary |

### Edge Agent Lifecycle

Each module in `edge_agent/modules/<name>/` must implement:

```python
# module.py

def init(config: dict) -> None:
    """Called once when module is loaded."""
    pass

def run(**kwargs) -> dict | None:
    """Called on each heartbeat or when a run command is dispatched.
    Return a dict of metric key-value pairs, or None if no data."""
    pass

def teardown() -> None:
    """Called when module is disabled or agent shuts down."""
    pass
```

Each module also needs a `manifest.json`:

```json
{
  "name": "speedtest",
  "version": "1.0.0",
  "description": "Internet speed test using speedtest-cli",
  "entrypoint": "module.py",
  "config_schema": {
    "intervalSeconds": { "type": "number", "default": 3600, "min": 300, "max": 86400 }
  }
}
```

### Heartbeat Extension

When enabled modules run, their output is attached to the heartbeat payload:

```json
{
  "type": "heartbeat",
  "payload": {
    "modules": {
      "speedtest": {
        "result": {
          "download_mbps": 95.4,
          "upload_mbps": 23.1,
          "ping_ms": 12,
          "server_name": "Manila, PH"
        }
      }
    }
  }
}
```

### API Command Dispatch

The API can send commands to modules via the heartbeat `ack`:

```json
{
  "type": "ack",
  "commands": [
    { "module": "speedtest", "action": "run" }
  ]
}
```

The edge agent dispatches these to the module's `run()` or named action handler.

---

## Adding a New Module

### 1. Edge Agent — Create Module Directory

```bash
cd apps/edge-agent/edge_agent/modules/
mkdir my-module
cd my-module
```

Create `manifest.json` and `module.py` following the contract above.

### 2. API — Register Module

Add the module to `apps/api/src/modules/devices/modules/service.js` in `MODULE_REGISTRY`:

```javascript
{
  name: "my-module",
  version: "1.0.0",
  description: "...",
  configSchema: { ... },
  supportedMetrics: ["metric1", "metric2"],
  requiresBinary: "optional-binary"
}
```

### 3. Web — Create Module Page (Optional)

Create a page component in `apps/web/src/modules/<name>/` and register it in the device detail routing if needed.

### 4. Rebuild & Restart

```bash
# API — restart if needed
npm run dev:api

# Edge agent — no restart needed, modules are discovered at runtime
```

---

## Architecture

```
Edge Agent                          API                           Web
----------                          ---                           ---
modules/                            MODULE_REGISTRY (in-memory)   DeviceModulesSection
  speedtest/
    manifest.json                   device_modules (DB table)     Module config forms
    module.py                       /devices/:uid/modules         Toggle / run buttons
      init()                        /devices/:uid/modules/:name   Dynamic module pages
      run()                           PATCH (enable/config)
      teardown()                      POST (queue run command)

Heartbeat payload.modules{}          Heartbeat ack.commands[]
```

---

## Current Modules

| Module | Status | Description |
|--------|--------|-------------|
| `speedtest` | Scaffolded | Internet speed test (requires `speedtest-cli` binary) |

---

## Constraints

- Modules are **opt-in** per device — an admin enables them via the web UI or API.
- The edge agent only runs modules that are both **installed** (directory exists) and **enabled** (from API config).
- Module results are stored in the `device_modules.last_result` JSONB column — persist-heavy modules should implement their own DB tables (see Card 3+).
- Backwards compatibility: old agents without module support continue to work; the API ignores unknown `modules` keys in heartbeats.
