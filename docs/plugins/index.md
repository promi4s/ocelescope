# Overview

Plugins are the primary way to extend Ocelescope with custom functionality — and they are designed to be easy to write, distribute, and use.

- **No frontend knowledge required** – Create plugins entirely in Python; the frontend UI is generated automatically.
- **Simple packaging** – Bundle your plugin as a single ZIP file and upload it at runtime.

An Ocelescope plugin is built from four main components:

1. **Resource Definitions** – Describe the plugin’s inputs and outputs.
2. **OCEL Extensions** – Extend the OCEL 2.0 event log structure in a standardized way.
3. **Input Schemas** – Python classes that define user-configurable parameters and generate the UI form.
4. **Plugin Class** – Implements the plugin’s methods, metadata, and execution logic.

This guide walks you through each component step by step, followed by a tutorial to help you build a complete plugin from scratch.
