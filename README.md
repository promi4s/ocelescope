# Ocelescope

🔗 **Documentation:** [rwth-pads.github.io/ocelescope](https://rwth-pads.github.io/ocelescope)

>
> ⚠️ **Project Status: Under Construction**
>
> This repository is actively being developed and is **not yet production-ready**.
> Expect frequent changes, incomplete features, and potential bugs.
> Contributions, feedback, and testing are welcome!
>

## ⚙️ Installation & Usage

This are the setup instructions for developing Ocelescope.
If you want to only run Ocelescope please use the installation instructions of the Documentation.

### 🧱 Prerequisites

Ensure you have the following installed:

- [Docker](https://docs.docker.com/get-docker/)
- [uv](https://docs.astral.sh/uv/)
- [npm](https://www.npmjs.com/package/npm)
- [just](https://github.com/casey/just)

To first setup the project you should run

```sh
just sync
```

### ▶️ Development Scripts

The Ocelescope project uses [just](https://github.com/casey/just) as a task runner. It allows you to run any commands from any point in the project.

| Command          | Description                                                       |
|------------------|-------------------------------------------------------------------|
| ``just docs``    | Locally launch documentation at <http://localhost:8000/ocelescope/> |
| ``just orval``   | Update API client of frontend                                     |
| ``just sync``    | Install backend and frontend packages, syncs API clients          |
| ``just up dev``  | Runs Ocelescope in dev mode at <http://localhost:3000>              |
| ``just up prod`` | Builds and runs Ocelescope at <http://localhost:3000>               |

To get a list of all available commands you can use the command:

```sh
just
```
