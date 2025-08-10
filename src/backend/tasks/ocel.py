from datetime import datetime
from pathlib import Path
from typing import TypedDict


from api.session import Session
from api.websocket import InvalidationRequest, OcelLink, SytemNotificiation
from ocelescope import OCEL
from tasks.system import system_task


class ImportOCELMetadata(TypedDict):
    fileName: str
    uploaded_at: str


@system_task(name="importOcel")
def import_ocel_task(
    session: Session,
    path: Path,
    name: str,
    upload_date: datetime,
    metadata: ImportOCELMetadata,
):
    ocel = OCEL.read_ocel(
        path,
        original_file_name=name,
        version_info=True,
        upload_date=upload_date,
    )

    ocel_id = session.add_ocel(ocel)

    return [
        SytemNotificiation(
            title="Ocel successfully uploaded",
            message=f"{ocel.meta.get('fileName', None) or 'OCEL '} was uploaded successfully",
            notification_type="info",
            link=OcelLink(ocel_id=ocel_id),
        ),
        InvalidationRequest(routes=["ocels"]),
    ]
