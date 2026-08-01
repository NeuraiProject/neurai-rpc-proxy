#!/bin/sh
# Renders /app/config.json from environment variables, then runs the proxy.
# Mirrors the env-driven convention used by docker/node/entrypoint.sh.
#
# Environment variables (all optional, defaults shown):
#   PROXY_PORT            19999                      local_port the proxy listens on
#   PROXY_CONCURRENCY     4                          max concurrent upstream RPC calls
#   PROXY_ENVIRONMENT     Neurai                     label exposed via GET /settings
#   PROXY_HEADING         Neurai RPC Proxy           label exposed via GET /settings
#   PROXY_ENDPOINT        (empty)                    public URL of this proxy (GET /settings)
#   NEURAI_NODE_NAME      neuraid                    node display name
#   NEURAI_NODE_URL       http://neuraid:19001       upstream node RPC URL
#   NEURAI_RPC_USER       neurai                     node rpcuser
#   NEURAI_RPC_PASSWORD   changeme                   node rpcpassword
#   PROXY_CONFIG_FORCE    0                          1 = regenerate even if a
#                                                    config.json is already present
#
# NEURAI_DEPIN_ENABLED/NEURAI_DEPIN_URL are gone: the proxy no longer connects to
# the DePIN gateway (raw TCP, port 19002). Every depin* command is a regular RPC
# on NEURAI_NODE_URL and goes through the whitelist like any other method.
set -eu

APP_DIR="${APP_DIR:-/app}"
CONFIG_FILE="$APP_DIR/config.json"

if [ -s "$CONFIG_FILE" ] && [ "${PROXY_CONFIG_FORCE:-0}" != "1" ]; then
  echo "[entrypoint] Using existing $CONFIG_FILE (mounted). Set PROXY_CONFIG_FORCE=1 to regenerate."
else
  if [ -n "${NEURAI_DEPIN_ENABLED:-}${NEURAI_DEPIN_URL:-}" ]; then
    echo "[entrypoint] NOTE: NEURAI_DEPIN_ENABLED/NEURAI_DEPIN_URL are obsolete and ignored." >&2
    echo "[entrypoint]       DePIN commands are served by the node's RPC port, not the gateway." >&2
  fi

  cat > "$CONFIG_FILE" <<EOF
{
  "concurrency": ${PROXY_CONCURRENCY:-4},
  "endpoint": "${PROXY_ENDPOINT:-}",
  "environment": "${PROXY_ENVIRONMENT:-Neurai}",
  "heading": "${PROXY_HEADING:-Neurai RPC Proxy}",
  "local_port": ${PROXY_PORT:-19999},
  "nodes": [
    {
      "name": "${NEURAI_NODE_NAME:-neuraid}",
      "username": "${NEURAI_RPC_USER:-neurai}",
      "password": "${NEURAI_RPC_PASSWORD:-changeme}",
      "neurai_url": "${NEURAI_NODE_URL:-http://neuraid:19001}"
    }
  ]
}
EOF
  echo "[entrypoint] Wrote $CONFIG_FILE (port ${PROXY_PORT:-19999}, node ${NEURAI_NODE_URL:-http://neuraid:19001})."
fi

exec "$@"
