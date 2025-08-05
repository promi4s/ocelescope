import { useGetFilters, useSetFilters } from "@/api/fastapi/ocels/ocels";
import FilterForm from "@/components/Filters";
import { LoadingOverlay } from "@mantine/core";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/router";

const FilterPage = () => {
  const {
    query: { slug },
  } = useRouter();
  const queryClient = useQueryClient();
  const { data: filter, isLoading } = useGetFilters({ ocel_id: slug?.[0] });
  const { mutate, isPending } = useSetFilters({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ refetchType: "all" });
      },
    },
  });
  return (
    <>
      <LoadingOverlay visible={isLoading || isPending} />
      {!isLoading && (
        <FilterForm
          filter={filter ?? {}}
          submit={(filter) => {
            mutate({ data: filter, params: { ocel_id: slug?.[0] } });
          }}
          ocel_id={slug?.[0]}
        />
      )}
    </>
  );
};
export default FilterPage;
