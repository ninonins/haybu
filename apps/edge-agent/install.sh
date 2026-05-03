#!/usr/bin/env bash
set -euo pipefail

# Haybu Edge Agent Installer
# Usage: sudo ./install.sh [DEVICE_NAME] [API_BASE_URL] [WS_BASE_URL]
#   DEVICE_NAME    - Display name for this device (default: hostname)
#   API_BASE_URL   - API URL (default: https://api-haybu.mr.jandayan.net)
#   WS_BASE_URL    - WebSocket URL (default: wss://api-haybu.mr.jandayan.net/ws/devices)
#   INSTALL_DIR    - Override install directory (default: /opt/haybu-edge-agent)
#   USER           - Run as user (default: haybu)

DEVICE_NAME="${1:-$(hostname)}"
API_BASE_URL="${2:-https://api-haybu.mr.jandayan.net}"
WS_BASE_URL="${3:-wss://api-haybu.mr.jandayan.net/ws/devices}"
INSTALL_DIR="${INSTALL_DIR:-/opt/haybu-edge-agent}"
RUN_USER="${USER:-haybu}"

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

# --- Install Python deps ---
echo "Installing Python dependencies..."
python3 -m pip install --upgrade pip > /dev/null 2>&1 || true
python3 -m pip install -r "$SCRIPT_DIR/requirements.txt" > /dev/null 2>&1

# --- Install app ---
echo "Installing edge agent to $INSTALL_DIR..."
rm -rf "$INSTALL_DIR"
mkdir -p "$INSTALL_DIR"
cp -r "$SCRIPT_DIR/edge_agent" "$INSTALL_DIR/"
cp "$SCRIPT_DIR/requirements.txt" "$INSTALL_DIR/"

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
ExecStart=/usr/bin/python3 -m edge_agent.cli
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

# --- Create symlink so python can find edge_agent module ---
PYTHON_SITE=$(python3 -m site --user-site 2>/dev/null || python3 -c "import site; print(site.getsitepackages()[0])")
rm -f "$PYTHON_SITE/edge_agent"
ln -s "$INSTALL_DIR/edge_agent" "$PYTHON_SITE/edge_agent"

# --- Reload and enable ---
systemctl daemon-reload
systemctl enable haybu-edge-agent.service

echo ""
echo "=== Installation complete ==="
echo "Start:   sudo systemctl start haybu-edge-agent"
echo "Status:  sudo systemctl status haybu-edge-agent"
echo "Logs:    sudo journalctl -u haybu-edge-agent -f"
echo "Pairing: Check logs for pairing code, then pair at $API_BASE_URL"
echo ""
echo "Edit config: sudo nano $INSTALL_DIR/.env"
echo "Restart:     sudo systemctl restart haybu-edge-agent"
