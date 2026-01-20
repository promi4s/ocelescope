from uuid import uuid4


def uuid_factory() -> str:
    return str(uuid4())
