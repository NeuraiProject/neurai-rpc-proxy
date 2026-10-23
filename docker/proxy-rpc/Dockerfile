# Neurai RPC Proxy — HTTP JSON-RPC safe proxy (Express).
#
# Build context is the repo ROOT (the app source lives there), even though this
# Dockerfile sits under docker/proxy-rpc/. The compose files build it with:
#     build: { context: ../.., dockerfile: docker/proxy-rpc/Dockerfile }
#
# docker-entrypoint.sh (next to this file) renders /app/config.json from
# environment variables on startup — see that script for the full list.
# Mount your own /app/config.json to bypass generation.
FROM node:24-alpine

# Tiny init so SIGTERM reaches node and zombies are reaped.
RUN apk add --no-cache tini

WORKDIR /app

# Install production dependencies first for better layer caching. Requires
# package-lock.json to be in sync with package.json (npm ci is strict).
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Application source. .dockerignore keeps out node_modules, .git, config.json
# and the other docker/ service folders, so the only docker/ file that lands in
# the image is docker/proxy-rpc/docker-entrypoint.sh (this Dockerfile is ignored).
COPY . .

RUN chmod +x /app/docker/proxy-rpc/docker-entrypoint.sh

ENV NODE_ENV=production
# Default proxy port; overridden by PROXY_PORT at runtime. EXPOSE is docs only.
EXPOSE 19999

ENTRYPOINT ["/sbin/tini", "--", "/app/docker/proxy-rpc/docker-entrypoint.sh"]
CMD ["node", "--no-deprecation", "index.js"]
