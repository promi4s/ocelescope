"""Escaping helpers for SQL built as text.

An OCEL's table and column names come from the log, not from us: ``ocel:activity``
carries a colon, an attribute may carry spaces, and nothing stops one carrying a
quote. Anywhere such a name -- or a value from the log -- is formatted into a query
rather than bound as a parameter, it has to be escaped, and these are the two ways
to do that.

Prefer binding values as ``?`` parameters over :func:`literal`; use ``literal``
only where a parameter cannot go, such as a constant column in a SELECT list.
Identifiers can never be parameters, so :func:`ident` is the only option there.
"""

from __future__ import annotations

__all__ = ["ident", "literal"]


def ident(name: str) -> str:
    """Quote ``name`` as a SQL identifier.

    Wrapping in double quotes and doubling any embedded quote is the SQL-standard
    way to escape an identifier, and it is what makes ``ocel:activity`` or an
    attribute named ``net price`` usable as a column reference.
    """
    return '"' + name.replace('"', '""') + '"'


def literal(value: str) -> str:
    """Render ``value`` as a SQL string literal, escaping embedded single quotes."""
    return "'" + value.replace("'", "''") + "'"
