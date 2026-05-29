# Office Parking Spot Manager (ParkDesk)

A self-hosted office parking space management system. Manage employees, parking spots, and daily check-ins through a web UI — all packaged as a single Docker container with a SQLite database.

## Features

- **Dashboard** — overview of spot occupancy and recent check-ins
- **Employees** — manage employee records and assign permanent parking spots
- **Spots** — manage parking spot inventory (permanent / flexible)
- **Check-ins** — track daily parking usage
- **Import** — bulk-load employees and spots via Excel template download/upload

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 7, TailwindCSS 4, TanStack Query, wouter |
| Backend | Node.js 24, Express 5, TypeScript |
| Database | SQLite via Drizzle ORM + @libsql/client |
| Build | pnpm 10 workspaces, esbuild |
| Container | Docker (single image, FE + BE) |

## Project Structure

```
artifacts/
  api-server/   Express API server
  parking/      React frontend (ParkDesk UI)
lib/
  db/           Drizzle schema + SQLite connection
  api-spec/     OpenAPI spec (orval source)
  api-zod/      Generated Zod validators
  api-client-react/  Generated React Query hooks
```

## Running with Docker

```bash
docker build -t office-spotter .
docker run -p 8080:8080 -v office-spotter-data:/data office-spotter
```

Open http://localhost:8080

The SQLite database is persisted in the `office-spotter-data` Docker volume at `/data/office-spotter.db`.

## Local Development

```bash
pnpm install

# Push schema to local SQLite
pnpm --filter @workspace/db run push

# Start API server (port 5000)
pnpm --filter @workspace/api-server run dev

# Start frontend dev server (port 3000)
pnpm --filter @workspace/parking run dev
```

Requires Node.js 24+ and pnpm 10.

## Bulk Import

1. Go to the **Import** page in the UI
2. Download the Excel template (two sheets: Employees and Parking Spots)
3. Fill in your data and upload — the server imports spots first, then employees, resolving spot assignments automatically

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `5000` (dev) / `8080` (Docker) | HTTP listen port |
| `DATABASE_URL` | `file:./office-spotter.db` | SQLite file path |
| `NODE_ENV` | `development` | Set to `production` in Docker |
