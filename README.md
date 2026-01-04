# Ocelescope

🔗 **Documentation:** <https://rwth-pads.github.io/ocelescope>

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
- [npm](https://www.npmjs.com/package/npm)
- [just](https://github.com/casey/just)

---

## 🚀 Getting Started

To set up the project for the first time, run:

```sh
just sync
```

This installs backend and frontend dependencies and synchronizes API clients.

---

## ▶️ Development Scripts

Ocelescope uses [`just`](https://github.com/casey/just) as a task runner, so you can execute commands from anywhere in the repository.

| Command          | Description                                                                 |
|------------------|-----------------------------------------------------------------------------|
| `just docs`      | Launch documentation locally at <http://localhost:8000/ocelescope/>         |
| `just orval`     | Update the frontend API client                                              |
| `just sync`      | Install backend and frontend packages, then sync API clients                |
| `just up dev`    | Run Ocelescope in development mode at <http://localhost:3000>               |
| `just up prod`   | Build and run Ocelescope (production) at <http://localhost:3000>            |

To list all available commands:

```sh
just
```
