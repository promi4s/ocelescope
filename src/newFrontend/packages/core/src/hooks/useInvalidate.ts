import { useQueryClient } from "@tanstack/react-query";

type InvalidationRouteName = "ocels" | "resources" | "tasks" | "plugins";

const useInvalidate = () => {
  const queryClient = useQueryClient();

  return async (routeNames: InvalidationRouteName[]) =>
    await queryClient.invalidateQueries({
      predicate: (query) =>
        typeof query.queryKey[0] === "string" &&
        routeNames.some((route) =>
          (query.queryKey[0] as string).includes(`/${route}`),
        ),
    });
};

export default useInvalidate;
