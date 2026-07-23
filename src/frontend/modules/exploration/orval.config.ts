import { defineConfig } from "@ocelescope/api-config";

const asQuery = { query: { useQuery: true } } as const;

export default defineConfig({
  exploration: {
    output: {
      target: "./src/api/exploration.ts",
      override: {
        operations: {
          queryEventAttributeDistribution: asQuery,
          queryObjectAttributeDistribution: asQuery,
          queryObjectCountsPerEvent: asQuery,
          queryObjectTypeCombinations: asQuery,
          queryActivityExecutionFrequency: asQuery,
          queryObjectInvolvementDistribution: asQuery,
          queryTimeBetweenActivities: asQuery,
          queryObjectActivityExecutionDistribution: asQuery,
          queryTotalObjectInvolvement: asQuery,
          queryObjectAttributeTimeline: asQuery,
        },
      },
    },
  },
  ocel: {
    input: "./openapi-ocel.json",
    output: {
      target: "./src/api/ocel/index.ts",
    },
  },
});
