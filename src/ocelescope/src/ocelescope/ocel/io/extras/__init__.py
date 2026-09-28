"""Tables of an OCEL log beyond the five flat OCEL tables, per file format.

Each format module reads a log's extra tables into DuckDB and writes them back:
:mod:`.json`, :mod:`.xml` and :mod:`.sqlite`. :mod:`.tables` decides what is
exported, and :mod:`.quantities` reads the deprecated quantity extension formats.
"""
