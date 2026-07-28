from datetime import datetime
from typing import Literal

OCELFileExtensions = Literal[".xml", ".json", ".sqlite"]

EPOCH = datetime(1970, 1, 1)

EPOCH_SQL = "make_timestamp(0)"
