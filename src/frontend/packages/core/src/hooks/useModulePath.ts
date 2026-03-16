import { useRouter } from "next/router";
import { useMemo } from "react";
import type { OcelescopeConfig } from "../lib/config";

const useModulePath = (config: OcelescopeConfig) => {
  const router = useRouter();
  const { slug } = router.query;
  const [moduleName, routeName] = [slug?.[0], slug?.[1]];

  const modulePath = useMemo(() => {
    const moduleConfig = config?.modules?.find(
      ({ name }) => name === moduleName,
    );
    const routeConfig = moduleConfig?.routes.find(
      ({ name }) => name === routeName,
    );

    return {
      moduleName: moduleConfig?.name,
      routeName: routeConfig?.name,
    };
  }, [moduleName, routeName]);

  return modulePath;
};

export default useModulePath;
