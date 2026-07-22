import { defineConfig } from "@ocelescope/api-config";

const asQuery = { query: { useQuery: true } } as const;

export default defineConfig({
  querying: {
    output: {
      target: "./src/api/querying.ts",
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
        },
      },
    },
  },
});
