# Ocelescope

🔗 **Documentation:** <https://www.ocelescope.org>

> ⚠️ **Project Status: Under Construction**
>
> This repository is under active development and is **not production-ready** yet.
> Expect frequent changes, incomplete features, and potential bugs.
>
> Contributions, feedback, and testing are welcome!

---

## ⚙️ Installation & Usage

These instructions are intended for **developing** Ocelescope locally.
If you only want to **run** Ocelescope, please follow the installation steps in the documentation linked above.

---

## 🧱 Prerequisites

Make sure you have the following tools installed:

- [Docker](https://docs.docker.com/get-docker/)
- [uv](https://docs.astral.sh/uv/)
- [pnpm](https://pnpm.io/)

> Note: This repo uses a pnpm workspace (see `pnpm-workspace.yaml`).

---

## 🚀 Getting Started

To set up the project for the first time, run:

```sh
pnpm run init
pnpm run api:sync
```

This will:

- install backend dependencies (via `uv`)
- install frontend dependencies (via `pnpm`)
- generate and build the frontend API client

---

## ▶️ Development Scripts

Common tasks are exposed as `pnpm` scripts at the repository root.

| Command | Description |
|---|---|
| `pnpm run dev:docs` | Launch documentation locally (MkDocs) with live reload |
| `pnpm run api:sync` | Generate OpenAPI spec and rebuild the frontend API client |
| `pnpm run dev` | Run the Docker-based development stack (`docker-compose.dev.yml`) |
| `pnpm run prod` | Build and run the production stack (`docker-compose.yml`) |
| `pnpm run down` | Stop containers (`docker compose down`) |
| `pnpm run lint` | Lint backend (ruff) + frontend (biome) |
| `pnpm run format` | Format backend (ruff) + frontend (biome) |

### Frontend-only

| Command | Description |
|---|---|
| `pnpm run dev:frontend` | Run dev servers for all frontend packages **except** the app |
| `pnpm run dev:app` | Run the app dev server |
| `pnpm run dev:all` | Run `dev:deps` + `dev:app` together |
| `pnpm run build:frontend` | Build all frontend packages **except** the app |

---

## 🔍 Helpful Notes

- If `pnpm` complains about your Node version, use the version specified in `.nvmrc`.  
- If you change backend routes/schemas, run `pnpm run api:sync` to refresh the generated client.

To see all available scripts:

```sh
pnpm run
```
