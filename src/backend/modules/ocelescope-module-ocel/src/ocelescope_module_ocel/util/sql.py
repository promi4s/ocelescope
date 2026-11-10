from ocelescope.util.sql import literal


def absent(value: str) -> str:
    return f"({value} IS NULL OR {value}::VARCHAR = '')"


def in_list(column: str, names: list[str]) -> str:
    if not names:
        return "false"
    return f"{column} IN ({', '.join(literal(name) for name in names)})"
