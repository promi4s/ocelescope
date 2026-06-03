import logging

import uvicorn.config


class IgnoreOptionsRequestsFilter(logging.Filter):
    def filter(self, record):
        if record.args is None:
            return True
        ip, method, route, _, code = record.args
        return method != "OPTIONS"


ignore_options_request_filter = IgnoreOptionsRequestsFilter("ignore_options_requests")


LOGGER_CONFIG = uvicorn.config.LOGGING_CONFIG
LOGGER_CONFIG["disable_existing_loggers"] = False

# logger = logging.getLogger("ocean")

# # Redirect own logger to uvicorn
# uvicorn_logger = logging.getLogger("uvicorn")
# for handler in uvicorn_logger.handlers:
#     logger.addHandler(handler)

access_logger = logging.getLogger("uvicorn.access")
access_logger.addFilter(ignore_options_request_filter)

logger = logging.getLogger("uvicorn.error")
# logger.setLevel(logging.INFO)
logger.setLevel(logging.DEBUG)
