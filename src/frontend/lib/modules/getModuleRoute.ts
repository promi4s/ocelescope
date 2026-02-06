import type Link from "next/link";
import type { ComponentProps } from "react";

const getModuleRoute = ({
  moduleName,
  routeName,
  query,
}: {
  moduleName: string;
  routeName: string;
  query?: Record<string, string>;
}) => {
  return {
    pathname: `/modules/${moduleName}/${routeName}`,
    ...(query && {
      query: {
        ...query,
      },
    }),
  } satisfies ComponentProps<typeof Link>["href"];
};

export default getModuleRoute;
