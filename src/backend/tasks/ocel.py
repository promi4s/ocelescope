from datetime import datetime
from pathlib import Path


from api.session import Session
from ocelescope import OCEL
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
    ocel = OCEL.read_ocel(
        path,
        original_file_name=name,
        version_info=True,
        upload_date=upload_date,
    )

    return ocel
