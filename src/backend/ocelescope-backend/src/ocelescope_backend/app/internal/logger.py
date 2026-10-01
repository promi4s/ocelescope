import logging
from copy import deepcopy
from typing import Any

import uvicorn.config

LOGGER_NAME = "ocelescope"

logger = logging.getLogger(LOGGER_NAME)


def get_logger(name: str) -> logging.Logger:
    return logger.getChild(name)


class IgnoreOptionsRequestsFilter(logging.Filter):
    """Drops uvicorn access log lines for CORS preflight requests."""

    def filter(self, record: logging.LogRecord) -> bool:
        args = record.args
        return not (isinstance(args, tuple) and len(args) > 1 and args[1] == "OPTIONS")


def build_log_config(level: str = "INFO") -> dict[str, Any]:
    config = deepcopy(uvicorn.config.LOGGING_CONFIG)
    config["disable_existing_loggers"] = False

    config["filters"] = {"ignore_options": {"()": IgnoreOptionsRequestsFilter}}
    config["handlers"]["access"]["filters"] = ["ignore_options"]

    config["formatters"]["ocelescope"] = {
        "()": "uvicorn.logging.DefaultFormatter",
        "fmt": "%(levelprefix)s [%(name)s] %(message)s",
    }
    config["handlers"]["ocelescope"] = {
        "formatter": "ocelescope",
        "class": "logging.StreamHandler",
        "stream": "ext://sys.stderr",
    }
    config["loggers"][LOGGER_NAME] = {
        "handlers": ["ocelescope"],
        "level": level,
        "propagate": False,
    }
    return config
