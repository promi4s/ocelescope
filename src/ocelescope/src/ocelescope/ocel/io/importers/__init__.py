"""Streaming importers that read an OCEL 2.0 file into the flat DuckDB tables.

Each reader parses its format incrementally and writes the five flat tables (plus
the optional quantity tables) through the shared :class:`OCELWriter`, so peak
memory stays bounded by a single entity rather than the whole log.
"""
