from pydantic import BaseModel


class Date_Distribution_Item(BaseModel):
    date: str
    entity_count: dict[str, int]


class Entity_Time_Info(BaseModel):
    start_time: str
    end_time: str
    date_distribution: list[Date_Distribution_Item]
