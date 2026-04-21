from __future__ import annotations

import platform
import socket
from datetime import datetime, UTC

import psutil


def _is_link_family(family) -> bool:
    if family in {
        getattr(socket, "AF_LINK", None),
        getattr(socket, "AF_PACKET", None),
        getattr(psutil, "AF_LINK", None),
    }:
        return True

    family_name = getattr(family, "name", "")
    return family_name in {"AF_LINK", "AF_PACKET"}


def _network_interfaces() -> list[dict]:
    interfaces: list[dict] = []
    for name, addrs in psutil.net_if_addrs().items():
        ips = []
        mac = ""
        for addr in addrs:
            family = getattr(addr, "family", None)
            if _is_link_family(family):
                mac = addr.address
            elif getattr(addr, "address", None) and "." in addr.address and not addr.address.startswith("127."):
                ips.append(addr.address)
        interfaces.append({"name": name, "ips": ips, "mac": mac})
    return interfaces


def build_system_inventory() -> dict:
    memory = psutil.virtual_memory()
    disks = []
    for partition in psutil.disk_partitions():
        try:
            usage = psutil.disk_usage(partition.mountpoint)
            disks.append(
                {
                    "device": partition.device,
                    "mountpoint": partition.mountpoint,
                    "filesystem": partition.fstype,
                    "totalBytes": usage.total,
                    "usedBytes": usage.used,
                    "freeBytes": usage.free,
                    "percentUsed": usage.percent,
                }
            )
        except PermissionError:
            continue

    return {
        "hostname": socket.gethostname(),
        "platform": platform.platform(),
        "system": platform.system(),
        "release": platform.release(),
        "machine": platform.machine(),
        "processor": platform.processor(),
        "pythonVersion": platform.python_version(),
        "cpuCountLogical": psutil.cpu_count(),
        "cpuCountPhysical": psutil.cpu_count(logical=False),
        "memoryTotalBytes": memory.total,
        "bootTime": datetime.fromtimestamp(psutil.boot_time(), UTC).isoformat(),
        "networkInterfaces": _network_interfaces(),
        "disks": disks,
    }


def build_payload(device_uid: str, services: list[dict], discovered_services: list[dict]) -> dict:
    inventory = build_system_inventory()
    return {
        "deviceId": device_uid,
        "agentVersion": "1.0.0",
        "sentAt": datetime.now(UTC).isoformat(),
        "system": {
            "hostname": inventory["hostname"],
            "platform": inventory["platform"],
            "cpuPercent": psutil.cpu_percent(interval=0.2),
            "memoryPercent": psutil.virtual_memory().percent,
            "diskPercent": psutil.disk_usage("/").percent,
        },
        "network": {
            "ips": sorted(
                {
                    addr.address
                    for interfaces in psutil.net_if_addrs().values()
                    for addr in interfaces
                    if "." in addr.address and not addr.address.startswith("127.")
                }
            )
        },
        "inventory": inventory,
        "discoveredServices": discovered_services,
        "services": services,
    }


def build_compact_heartbeat_payload(
    device_uid: str,
    services: list[dict],
    discovered_services: list[dict],
    include_inventory: bool,
) -> dict:
    payload = build_payload(device_uid, services, discovered_services)
    if not include_inventory:
        payload.pop("inventory", None)
    return payload
