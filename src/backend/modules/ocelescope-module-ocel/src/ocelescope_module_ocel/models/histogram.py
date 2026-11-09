from pydantic import BaseModel


class Bin(BaseModel):
    start: float | str
    end: float | str
    count: int
