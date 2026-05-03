"""Haybu Edge Agent Module System.

Modules are discovered from the edge_agent/modules/ directory.
Each module is a folder containing:
  - manifest.json: { "name", "version", "description", "entrypoint", "config_schema" }
  - module.py: must export init(), run(), teardown()

Modules extend heartbeat payload under payload.modules[name].
API commands to modules are dispatched via heartbeat ack.commands.
"""
from __future__ import annotations

import importlib.util
import json
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

MODULES_DIR = Path(__file__).parent


@dataclass
class ModuleManifest:
    name: str
    version: str
    description: str
    entrypoint: str
    config_schema: dict | None = None


class Module:
    def __init__(self, manifest: ModuleManifest, module_dir: Path, instance: Any = None):
        self.manifest = manifest
        self.module_dir = module_dir
        self.instance = instance
        self._config: dict = {}

    @property
    def name(self) -> str:
        return self.manifest.name

    def init(self, config: dict | None = None) -> None:
        self._config = config or {}
        if self.instance and hasattr(self.instance, "init"):
            self.instance.init(self._config)

    def run(self, **kwargs) -> dict | None:
        if self.instance and hasattr(self.instance, "run"):
            return self.instance.run(**kwargs)
        return None

    def teardown(self) -> None:
        if self.instance and hasattr(self.instance, "teardown"):
            self.instance.teardown()
        self.instance = None


def _load_manifest(module_dir: Path) -> ModuleManifest | None:
    manifest_path = module_dir / "manifest.json"
    if not manifest_path.exists():
        return None
    try:
        data = json.loads(manifest_path.read_text())
        return ModuleManifest(
            name=data["name"],
            version=data["version"],
            description=data.get("description", ""),
            entrypoint=data.get("entrypoint", "module.py"),
            config_schema=data.get("config_schema"),
        )
    except (json.JSONDecodeError, KeyError):
        return None


def _load_instance(module_dir: Path, entrypoint: str):
    module_file = module_dir / entrypoint
    if not module_file.exists():
        return None
    try:
        spec = importlib.util.spec_from_file_location(
            f"edge_agent.modules.{module_dir.name}", module_file
        )
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        return mod
    except Exception:
        return None


def discover_modules() -> list[Module]:
    """Discover all modules in the modules directory."""
    modules: list[Module] = []
    for item in MODULES_DIR.iterdir():
        if not item.is_dir() or item.name.startswith("_"):
            continue
        manifest = _load_manifest(item)
        if not manifest:
            continue
        instance = _load_instance(item, manifest.entrypoint)
        modules.append(Module(manifest=manifest, module_dir=item, instance=instance))
    return modules


class ModuleManager:
    def __init__(self):
        self._modules: dict[str, Module] = {}
        self._enabled: set[str] = set()
        self._last_run_at: dict[str, float] = {}
        self._pending_results: dict[str, dict] = {}

    def load_all(self, module_configs: dict[str, dict] | None = None):
        """Discover and init all modules with optional per-module config."""
        self._modules.clear()
        self._enabled.clear()
        for mod in discover_modules():
            cfg = (module_configs or {}).get(mod.name, {})
            module_config = cfg.get("config", {}) if isinstance(cfg, dict) else {}
            mod.init(module_config)
            self._modules[mod.name] = mod
            if isinstance(cfg, dict) and cfg.get("enabled"):
                self._enabled.add(mod.name)

    def enable(self, name: str, config: dict | None = None) -> bool:
        mod = self._modules.get(name)
        if not mod:
            return False
        mod.init(config or {})
        self._enabled.add(name)
        return True

    def disable(self, name: str) -> bool:
        if name not in self._enabled:
            return False
        mod = self._modules.get(name)
        if mod:
            mod.teardown()
        self._enabled.discard(name)
        self._last_run_at.pop(name, None)
        self._pending_results.pop(name, None)
        return True

    def is_enabled(self, name: str) -> bool:
        return name in self._enabled

    def _interval_seconds(self, mod: Module) -> float | None:
        interval = mod._config.get("intervalSeconds")
        if interval is None or interval == "":
            return None
        try:
            parsed = float(interval)
            return parsed if parsed > 0 else None
        except (TypeError, ValueError):
            return None

    def _is_due(self, name: str, mod: Module, now: float) -> bool:
        interval = self._interval_seconds(mod)
        if interval is None:
            return True
        last_run_at = self._last_run_at.get(name)
        return last_run_at is None or now - last_run_at >= interval

    def run_due(self) -> dict[str, dict]:
        """Run enabled modules whose interval has elapsed and return their results."""
        results: dict[str, dict] = self._pending_results
        self._pending_results = {}
        now = time.monotonic()
        for name in self._enabled:
            mod = self._modules.get(name)
            if name in results or not mod or not self._is_due(name, mod, now):
                continue
            try:
                result = mod.run()
                self._last_run_at[name] = time.monotonic()
                if result is not None:
                    results[name] = {"result": result}
            except Exception as exc:
                self._last_run_at[name] = time.monotonic()
                results[name] = {"error": str(exc)}
        return results

    def run_all(self) -> dict[str, dict]:
        """Run all enabled modules and return their results."""
        results: dict[str, dict] = {}
        for name in self._enabled:
            mod = self._modules.get(name)
            if not mod:
                continue
            try:
                result = mod.run()
                self._last_run_at[name] = time.monotonic()
                if result is not None:
                    results[name] = {"result": result}
            except Exception as exc:
                self._last_run_at[name] = time.monotonic()
                results[name] = {"error": str(exc)}
        return results

    def dispatch_command(self, command: dict) -> dict:
        """Dispatch a single command from API to the target module."""
        name = command.get("module")
        action = command.get("action", "run")
        mod = self._modules.get(name)
        if not mod:
            return {"error": f"Module {name} not found"}
        if not self.is_enabled(name):
            return {"error": f"Module {name} not enabled"}
        try:
            if action == "run":
                result = mod.run()
                self._last_run_at[name] = time.monotonic()
                if result is not None:
                    self._pending_results[name] = {"result": result}
                return {"result": result} if result is not None else {}
            if hasattr(mod.instance, action):
                handler = getattr(mod.instance, action)
                result = handler()
                if result is not None:
                    self._pending_results[name] = {"result": result}
                return {"result": result} if result is not None else {}
            return {"error": f"Action {action} not supported by module {name}"}
        except Exception as exc:
            self._pending_results[name] = {"error": str(exc)}
            return {"error": str(exc)}

    def get_status(self) -> dict[str, dict]:
        return {
            name: {
                "enabled": self.is_enabled(name),
                "version": mod.manifest.version,
            }
            for name, mod in self._modules.items()
        }
