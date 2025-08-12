import json
import os
from copy import deepcopy
from functools import cached_property
from typing import Any

from pydantic import Field, FilePath

import util.misc as util
from api.config import config
from api.logger import logger
from api.model.base import ApiBaseModel
from api.session import Session
from ocelescope import OCEL

OCEL_BASE_PATH = None
DEFAULT_OCELS: list["DefaultOCEL"] = []
DEFAULT_OCEL_KEYS: list[str] = []


class DefaultOCEL(ApiBaseModel):
    """Definition of a default OCEL on the server, for quick access. Supports pre-loading the OCEL on backend init."""

    key: str
    name: str
    version: str
    file: str
    url: str | None = None
    abbr_map: dict[str, str] | None = Field(default=None, exclude=True)
    preload: bool = Field(default=False)
    hide: bool = Field(default=False)

    @property
    def path(self) -> FilePath:
        if not OCEL_BASE_PATH:
            raise ValueError("OCEL_BASE_PATH is not defined.")
        return OCEL_BASE_PATH / self.file

    @cached_property
    def default_app_state(self) -> dict[str, Any] | None:
        if not OCEL_BASE_PATH:
            return None
        json_path = OCEL_BASE_PATH / (self.file + ".meta.json")
        if not os.path.exists(json_path):
            return None
        return json.load(open(json_path, "r", encoding="utf8"))

    def get_ocel_copy(self, use_abbreviations: bool = False) -> OCEL:
        """Reads the OCEL from the given file (if not done yet), and returns a copy of the stored OCEL object."""
        self.load_ocel()
        ocel = getattr(self, "__ocel")
        ocel = deepcopy(ocel)
        if use_abbreviations and self.abbr_map:
            ocel = ocel.translate(self.abbr_map)
        return ocel

    def load_ocel(self):
        """Reads the OCEL from the given file."""
        if hasattr(self, "__ocel"):
            return
        logger.info('Reading OCEL 2.0 "%s" ...', self.name)
        ocel = OCEL.read_ocel(
            self.path,
        )
        object.__setattr__(self, "__ocel", ocel)


# Try to load event_logs.json only if everything is present
try:
    if config.DATA_DIR:
        event_log_path = (config.DATA_DIR / "event_logs.json").resolve(strict=False)
        if event_log_path.exists():
            with event_log_path.open("r", encoding="utf-8") as f:
                data = json.load(f)

            if "base_path" in data:
                OCEL_BASE_PATH = (config.DATA_DIR / data["base_path"]).resolve(
                    strict=False
                )

                # Create DefaultOCEL instances
                DEFAULT_OCELS = [
                    DefaultOCEL(**event_log)
                    for event_log in sorted(
                        data.get("event_logs", []),
                        key=lambda d: (d["key"], d.get("version", "1.0")),
                    )
                ]
                DEFAULT_OCEL_KEYS = util.unique([d.key for d in DEFAULT_OCELS])

                logger.info(
                    f"{len(DEFAULT_OCELS)} OCELs available (keys: {util.set_str(DEFAULT_OCEL_KEYS)})"
                )
            else:
                logger.warning("Missing 'base_path' in event_logs.json.")
        else:
            logger.info("event_logs.json not found — skipping OCEL loading.")
    else:
        logger.info("DATA_DIR not set — skipping OCEL loading.")

except Exception as e:
    logger.error(f"Error loading OCEL configuration: {e}")


def filter_default_ocels(
    filtered: list[DefaultOCEL] | None = None,
    /,
    *,
    key: str | None = None,
    version: str | None = None,
    exclude_hidden: bool = True,
    only_latest_versions: bool = True,
    only_preloaded: bool = False,
):
    if filtered is None:
        filtered = DEFAULT_OCELS
    if key is not None:
        filtered = [d for d in filtered if d.key == key]
    if version is not None:
        filtered = [d for d in filtered if str(d.version) == str(version)]
    if exclude_hidden:
        filtered = [d for d in filtered if not d.hide]
    if only_preloaded:
        filtered = [d for d in filtered if d.preload]

    if only_latest_versions:
        by_key = {}
        for default_ocel in filtered:
            by_key[default_ocel.key] = default_ocel
        filtered = list(by_key.values())
    return filtered


def get_default_ocel(key: str, version: str | None = None):
    """Returns default OCEL data for a given key and version. If version=None, returns the most recent version."""
    if key not in DEFAULT_OCEL_KEYS:
        return None
    if version is not None:
        results = filter_default_ocels(
            key=key,
            version=version,
            only_latest_versions=False,
            exclude_hidden=False,
        )
        if len(results) > 1:
            logger.warning(f"OCEL {key}, version {version} is not unique.")
    else:
        results = filter_default_ocels(
            key=key,
            version=None,
            only_latest_versions=True,
            exclude_hidden=False,
        )
    assert len(results) <= 1
    if not results:
        return None
    return results[0]


def load_default_ocels() -> list[Session]:
    """Pre-loads some OCELs (with preload=True) at server start for faster session init."""
    sessions = []
    for ocel_data in filter_default_ocels(
        only_preloaded=True,
        exclude_hidden=True,
        only_latest_versions=True,
    ):
        key = ocel_data.key
        if not ocel_data.path:
            raise ValueError(f"Default OCEL {key}: No path specified.")

        ocel_data.load_ocel()

        # Init dummy session with consistent key (for API playground)
        ocel = getattr(ocel_data, "__ocel")
        session = Session(id=key)
        session.add_ocel(ocel)
        session.set_current_ocel(session.add_ocel(ocel))
        sessions.append(session)

    return sessions
