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
#   NEURAI_DEPIN_ENABLED  false                      enable DePIN (1/true/yes/on)
#   NEURAI_DEPIN_URL      (unset)                    DePIN gateway URL; if unset the
#                                                    proxy derives it (19001->19002)
#   PROXY_CONFIG_FORCE    0                          1 = regenerate even if a
#                                                    config.json is already present
set -eu

APP_DIR="${APP_DIR:-/app}"
CONFIG_FILE="$APP_DIR/config.json"

if [ -s "$CONFIG_FILE" ] && [ "${PROXY_CONFIG_FORCE:-0}" != "1" ]; then
  echo "[entrypoint] Using existing $CONFIG_FILE (mounted). Set PROXY_CONFIG_FORCE=1 to regenerate."
else
  # Normalize DePIN flag to a JSON boolean.
  case "$(printf '%s' "${NEURAI_DEPIN_ENABLED:-false}" | tr '[:upper:]' '[:lower:]')" in
    1 | true | yes | on) DEPIN_ENABLED=true ;;
    *) DEPIN_ENABLED=false ;;
  esac

  # depin_url is optional: include it only when provided (else the proxy
  # auto-derives it from neurai_url). Keep it last so the JSON stays comma-clean.
  if [ -n "${NEURAI_DEPIN_URL:-}" ]; then
    NODE_TAIL="\"depin_enabled\": ${DEPIN_ENABLED},
      \"depin_url\": \"${NEURAI_DEPIN_URL}\""
  else
    NODE_TAIL="\"depin_enabled\": ${DEPIN_ENABLED}"
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
      "neurai_url": "${NEURAI_NODE_URL:-http://neuraid:19001}",
      ${NODE_TAIL}
    }
  ]
}
EOF
  echo "[entrypoint] Wrote $CONFIG_FILE (port ${PROXY_PORT:-19999}, node ${NEURAI_NODE_URL:-http://neuraid:19001}, depin ${DEPIN_ENABLED})."
fi

exec "$@"
