# main.py
import os
import sys
import signal
import asyncio
import threading
import subprocess
from uvicorn import Config, Server

# Import the FastAPI app
from app import app

# Configuration via environment variables
HOST = os.getenv("API_HOST", "0.0.0.0")
PORT = int(os.getenv("API_PORT", "8000"))
LOG_LEVEL = os.getenv("API_LOG_LEVEL", "info")
DEV_MODE = os.getenv("DEV_MODE", "false").lower() == "true"

server_instance = None


def kill_process():
    """Shut down the server process."""
    os.kill(os.getpid(), signal.SIGINT)


def stdin_loop():
    """Listen for stdin commands (used by Tauri to shut down)."""
    print("[server] Waiting for commands... (type 'shutdown' to exit)", flush=True)
    while True:
        user_input = sys.stdin.readline().strip()
        if user_input == "shutdown":
            print("[server] Shutting down...", flush=True)
            kill_process()
        else:
            print(f"[server] Unknown command: {user_input}", flush=True)


def start_input_thread():
    """Run the stdin listener in a background thread."""
    input_thread = threading.Thread(target=stdin_loop)
    input_thread.daemon = True
    input_thread.start()


def start_server():
    """Start server in production mode."""
    global server_instance
    if server_instance is None:
        print(f"[server] Starting production server on {HOST}:{PORT}...", flush=True)
        config = Config(app=app, host=HOST, port=PORT, log_level=LOG_LEVEL)
        server_instance = Server(config)
        asyncio.run(server_instance.serve())
    else:
        print("[server] Server already running.", flush=True)


if __name__ == "__main__":
    start_input_thread()
    start_server()
