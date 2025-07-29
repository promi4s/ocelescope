from datetime import datetime
from pathlib import Path

from api.session import Session
from ocel.ocel_wrapper import OCELWrapper
from util.tasks import task


@task(success_message="Ocel was uploaded successfully")
def import_ocel_task(
    session: Session,
    path: Path,
    name: str,
    suffix: str,
    upload_date: datetime,
    stop_event=None,
):  # Save file
    # pm4py-based import
    ocel = OCELWrapper.read_ocel(
        str(path),
        original_file_name=name,
        version_info=True,
        output=True,
        upload_date=upload_date,
    )

    return ocel
