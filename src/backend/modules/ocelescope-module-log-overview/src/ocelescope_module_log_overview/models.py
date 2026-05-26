from pydantic import BaseModel


class NumericValues(BaseModel):
    values: list[float]
    missing_count: int
