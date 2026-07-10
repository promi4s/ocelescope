import { useQueryClient } from "@tanstack/react-query";

type InvalidationRouteName =
  | "ocels"
  | "resources"
  | "tasks"
  | "plugins"
  | "discoveryMethods";

const ROUTE_PATH: Record<InvalidationRouteName, string> = {
  ocels: "ocels",
  resources: "resources",
  tasks: "tasks",
  plugins: "plugins",
  discoveryMethods: "discovery/methods",
};

export const useInvalidate = () => {
  const queryClient = useQueryClient();

  return async (routeNames: InvalidationRouteName[]) =>
    await queryClient.invalidateQueries({
      predicate: (query) =>
        typeof query.queryKey[0] === "string" &&
        routeNames.some((route) =>
          (query.queryKey[0] as string).includes(`/${ROUTE_PATH[route]}`),
        ),
    });
};
