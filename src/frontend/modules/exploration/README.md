# @ocelescope/exploration

Interactive, schema-aware OCEL exploration. The module does not own or
reproduce the log filter pipeline; analytical queries automatically use the
active filtered OCEL.

The dashboard is built from a registry of analytical questions. Every
visualization uses an equal-size card with maximize, information, and image
export actions. The first registered analysis shows event-attribute
distributions as an explicitly selected histogram, bar chart, or donut chart.
Object-attribute distributions reuse the same chart presentation while
resolving dynamic values at the time of each matching event-object relation.
Their editor progressively limits object types to those involved in the
selected activity, based on stable options from the original OCEL.
Dashboard configurations are versioned and stored locally per OCEL.

A separate analytical-schema page presents physical and inferred analytical
types, data coverage, and object-attribute lifecycle metadata. Compatible
interpretations are configured once per OCEL and reused by analytical queries.
Visualization compatibility is a frontend concern and is not included in the
backend schema. The generated querying client is module-local under `src/api`,
following the frontend module pattern.
