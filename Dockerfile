# ---- base: pnpm enabled ----
FROM node:24-slim AS base
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate

# ---- build: install all deps, compile FE + BE ----
FROM base AS build
WORKDIR /app

# Copy workspace manifests first (better layer caching)
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json .npmrc ./
COPY lib/api-spec/package.json         lib/api-spec/
COPY lib/api-client-react/package.json lib/api-client-react/
COPY lib/api-zod/package.json          lib/api-zod/
COPY lib/db/package.json               lib/db/
COPY artifacts/api-server/package.json artifacts/api-server/
COPY artifacts/parking/package.json    artifacts/parking/

# shamefully-hoist puts every package at root node_modules so the esbuild
# bundle can resolve native addons (e.g. @libsql/linux-x64-gnu) at runtime.
RUN echo "shamefully-hoist=true" >> .npmrc && pnpm install --frozen-lockfile

# Copy full source
COPY . .

# Build frontend (BASE_PATH=/ so assets resolve from root)
RUN BASE_PATH=/ pnpm --filter @workspace/parking run build

# Build backend
RUN pnpm --filter @workspace/api-server run build

# Prune dev dependencies to slim down the node_modules we ship
RUN CI=true pnpm prune --prod

# ---- runtime: minimal image ----
FROM node:24-slim AS runtime
WORKDIR /app

# Hoisted production node_modules (includes @libsql native addon for linux-x64-gnu)
COPY --from=build /app/node_modules ./node_modules

# Compiled server bundle (index.mjs + pino worker files)
COPY --from=build /app/artifacts/api-server/dist ./dist

# Compiled frontend — Express serves this at / in production
COPY --from=build /app/artifacts/parking/dist/public ./dist/public

# Persistent volume for the SQLite database file
RUN mkdir -p /data
VOLUME /data

ENV NODE_ENV=production
ENV PORT=8080
ENV DATABASE_URL=file:/data/office-spotter.db

EXPOSE 8080

CMD ["node", "--enable-source-maps", "./dist/index.mjs"]
