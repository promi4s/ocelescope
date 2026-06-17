import { useRouter } from "next/router";
import { useMemo } from "react";

type UseCurrentFilterTabOptions<T extends string> = {
  defaultTab: T;
  queryKey?: string;
  tabs: T[];
};

export const useCurrentFilterTab = <T extends string>({
  defaultTab,
  queryKey = "tab",
  tabs,
}: UseCurrentFilterTabOptions<T>) => {
  const router = useRouter();

  const currentTab = useMemo(() => {
    const raw = router.query[queryKey];

    const tab = typeof raw === "string" ? raw : defaultTab;

    return tabs.includes(tab as T) ? tab : defaultTab;
  }, [router.query, queryKey, defaultTab]);

  const setCurrentTab = (tab: T) => {
    router.replace(
      {
        pathname: router.pathname,
        query: {
          ...router.query,
          [queryKey]: tab,
        },
      },
      undefined,
      { shallow: true },
    );
  };

  return {
    currentTab,
    setCurrentTab,
  };
};
