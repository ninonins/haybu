#!/usr/bin/env bash
set -euo pipefail

# Haybu Edge Agent Installer
# Usage: sudo ./install.sh [DEVICE_NAME]
#   DEVICE_NAME    - Display name for this device (default: hostname)
#
# Configure API/WS URLs by editing /opt/haybu-edge-agent/.env after install.

DEVICE_NAME="${1:-$(hostname)}"
INSTALL_DIR="${INSTALL_DIR:-/opt/haybu-edge-agent}"
RUN_USER="${RUN_USER:-haybu}"
API_BASE_URL="${API_BASE_URL:-https://api-haybu.mr.jandayan.net}"
WS_BASE_URL="${WS_BASE_URL:-wss://api-haybu.mr.jandayan.net/ws/devices}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=== Haybu Edge Agent Installer ==="
echo "Device name: $DEVICE_NAME"
echo "API base:    $API_BASE_URL"
echo "WS base:     $WS_BASE_URL"
echo "Install dir: $INSTALL_DIR"
echo "Run as user: $RUN_USER"
echo ""

# --- Check root ---
if [ "$EUID" -ne 0 ]; then
    echo "Please run as root (sudo)"
    exit 1
fi

# --- Create user if not exists ---
if ! id "$RUN_USER" &> /dev/null 2>&1; then
    echo "Creating user: $RUN_USER"
    useradd --system --no-create-home --shell /usr/sbin/nologin "$RUN_USER"
else
    echo "User $RUN_USER already exists"
fi

# --- Install Python deps into venv ---
echo "Setting up Python virtual environment..."
if ! python3 --version &> /dev/null; then
    echo "ERROR: python3 not found. Install it first."
    exit 1
fi
python3 -m venv "$INSTALL_DIR/venv"
"$INSTALL_DIR/venv/bin/pip" install --upgrade pip
"$INSTALL_DIR/venv/bin/pip" install -r "$SCRIPT_DIR/requirements.txt"

# --- Install app ---
echo "Installing edge agent to $INSTALL_DIR..."
rm -rf "$INSTALL_DIR/edge_agent"
cp -r "$SCRIPT_DIR/edge_agent" "$INSTALL_DIR/"
cp "$SCRIPT_DIR/requirements.txt" "$INSTALL_DIR/"

# --- Module Onboarding ---
MODULES_DIR="$INSTALL_DIR/edge_agent/modules"
AVAILABLE_MODULES=()
for dir in "$MODULES_DIR"/*/; do
    [ -d "$dir" ] || continue
    name=$(basename "$dir")
    [ "$name" = "__pycache__" ] && continue
    AVAILABLE_MODULES+=("$name")
done

echo ""
echo "=== Available Modules ==="
SELECTED_MODULES=()
for mod in "${AVAILABLE_MODULES[@]}"; do
    manifest="$MODULES_DIR/$mod/manifest.json"
    desc=""
    if [ -f "$manifest" ]; then
        desc=$(python3 -c "import json,sys; print(json.load(open('$manifest')).get('description',''))" 2>/dev/null || true)
    fi
    printf "  %-15s %s\n" "[$mod]" "$desc"
done

echo ""
for mod in "${AVAILABLE_MODULES[@]}"; do
    read -p "Enable module '$mod'? [y/N]: " ans
    if [[ "$ans" =~ ^[Yy]$ ]]; then
        SELECTED_MODULES+=("$mod")
    fi
done

# Pre-install module dependencies
if [ ${#SELECTED_MODULES[@]} -gt 0 ]; then
    echo ""
    echo "=== Installing module dependencies ==="
    for mod in "${SELECTED_MODULES[@]}"; do
        manifest="$MODULES_DIR/$mod/manifest.json"
        if [ -f "$manifest" ]; then
            install_script=$(python3 -c "
import json,sys
try:
    d=json.load(open('$manifest'))
    print(d.get('install',{}).get('script',''))
except: pass
" 2>/dev/null || true)
            install_desc=$(python3 -c "
import json,sys
try:
    d=json.load(open('$manifest'))
    print(d.get('install',{}).get('description','Installing...'))
except: pass
" 2>/dev/null || true)
            if [ -n "$install_script" ]; then
                echo "[$mod] $install_desc"
                if bash -c "$install_script"; then
                    echo "[$mod] ✓ Installed successfully"
                else
                    echo "[$mod] ✗ Install failed (will retry at runtime)"
                fi
            fi
        fi
    done
fi

# --- Create .env ---
echo "Creating environment config..."
cat > "$INSTALL_DIR/.env" << EOF
API_BASE_URL=$API_BASE_URL
WS_BASE_URL=$WS_BASE_URL
DEVICE_NAME=$DEVICE_NAME
HEARTBEAT_INTERVAL_SECONDS=30
STATE_DIR=/var/lib/haybu-edge-agent
SERVICES_JSON=[]
EOF

if [ ${#SELECTED_MODULES[@]} -gt 0 ]; then
    MODULES_JSON=$(printf '%s\n' "${SELECTED_MODULES[@]}" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read().strip().splitlines()))')
    echo "MODULES_ENABLED=$MODULES_JSON" >> "$INSTALL_DIR/.env"
fi

# --- Create state directory ---
mkdir -p /var/lib/haybu-edge-agent
chown -R "$RUN_USER:$RUN_USER" /var/lib/haybu-edge-agent
chmod 700 /var/lib/haybu-edge-agent

# --- Create systemd service ---
echo "Creating systemd service..."
cat > /etc/systemd/system/haybu-edge-agent.service << EOF
[Unit]
Description=Haybu Edge Agent
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$RUN_USER
Group=$RUN_USER
WorkingDirectory=$INSTALL_DIR
EnvironmentFile=$INSTALL_DIR/.env
Environment=PYTHONPATH=$INSTALL_DIR
Environment=PYTHONUNBUFFERED=1
ExecStart=$INSTALL_DIR/venv/bin/python -m edge_agent.cli --config $INSTALL_DIR/.env
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

# Hardening (relaxed for system metrics: psutil needs /proc, /sys, /dev)
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/haybu-edge-agent /tmp
RestrictSUIDSGID=true
RestrictRealtime=true

[Install]
WantedBy=multi-user.target
EOF

# --- Reload and enable ---
systemctl daemon-reload
systemctl enable haybu-edge-agent.service

echo ""
echo "=== Installation complete ==="
echo "Selected modules: ${SELECTED_MODULES[@]:-(none)}"
echo ""
echo "Start:   sudo systemctl start haybu-edge-agent"
echo "Status:  sudo systemctl status haybu-edge-agent"
echo "Logs:    sudo journalctl -u haybu-edge-agent -f"
echo "Pairing: Check logs for pairing code, then pair at $API_BASE_URL"
echo ""
echo "Edit config: sudo nano $INSTALL_DIR/.env"
echo "Restart:     sudo systemctl restart haybu-edge-agent"
