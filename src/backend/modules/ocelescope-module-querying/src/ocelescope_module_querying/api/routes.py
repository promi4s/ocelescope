from fastapi import APIRouter, HTTPException

from ocelescope_module_querying.api.schemas import (
    OcelQueryBody,
    OcelQueryResponse,
    OcelSchemaResponse,
)
from ocelescope_module_querying.domain.query import InvalidOcelQuery
from ocelescope_backend.app.dependencies import ApiOcel
from ocelescope_module_querying.infrastructure.query_engine import (
    describe_ocel,
    execute_query,
)

router = APIRouter()


@router.get("/{ocel_id}/schema", operation_id="ocelSchema")
def ocel_schema(ocel: ApiOcel) -> OcelSchemaResponse:
    schema = describe_ocel(ocel)
    return OcelSchemaResponse.from_domain(schema)


@router.post("/{ocel_id}/query", operation_id="ocelQuery")
def ocel_query(
    ocel: ApiOcel,
    body: OcelQueryBody,
) -> OcelQueryResponse:
    try:
        query = body.to_domain()
        result = execute_query(ocel, query)
    except InvalidOcelQuery as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    return OcelQueryResponse.from_domain(result)
