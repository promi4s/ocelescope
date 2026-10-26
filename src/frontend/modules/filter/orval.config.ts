import { defineConfig } from "@ocelescope/api-config";

// The previews are reads that take the draft steps as a body, so they are POSTs
// -- but queries, not mutations.
const PREVIEWS = [
  "previewEventCounts",
  "previewObjectCounts",
  "previewTimeInfo",
  "previewAttributeNames",
  "previewAggregatedAttributes",
  "previewTypedAttributes",
  "previewAttributeDistribution",
  "previewAttributeValues",
  "previewRelations",
  "previewRelationCombinations",
  "previewRelationCountDistribution",
];

export default defineConfig({
  base: {
    output: {
      target: "./src/api/base.ts",
      override: {
        operations: Object.fromEntries(
          PREVIEWS.map((operation) => [
            operation,
            { query: { useQuery: true, useMutation: false } },
          ]),
        ),
      },
    },
  },
});
