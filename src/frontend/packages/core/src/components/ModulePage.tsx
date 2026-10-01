import { Alert } from "@mantine/core";
import { useGetOcels } from "@ocelescope/api-base";
import type { GetStaticPaths, GetStaticProps, NextPage } from "next";
import { useCurrentOcel } from "../hooks/useCurrentOCEL";
import type { OcelescopeConfig } from "../lib/config";
import { canAccessRoute } from "../lib/routeAccess";

type ModulePageProps = {
  moduleName: string;
  routeName: string;
};

export const createModulesPage = (config: OcelescopeConfig) => {
  const { modules = [] } = config;

  const getStaticPaths: GetStaticPaths = async () => {
    const paths = modules.flatMap(({ name: moduleName, routes }) => [
      ...routes.map(({ name: routeName }) => ({
        params: { slug: [moduleName, routeName] },
      })),
      { params: { slug: [moduleName] } },
    ]);

    return {
      paths: [...paths, { params: { slug: [] } }],
      fallback: false,
    };
  };

  const getStaticProps: GetStaticProps<ModulePageProps> = async ({
    params,
  }) => {
    const slugs: string[] = (params?.slug ?? []) as string[];

    const moduleDef = slugs[0]
      ? modules.find(({ name }) => name === slugs[0])
      : modules[0];

    const routeDef = slugs[1]
      ? moduleDef?.routes.find(({ name }) => name === slugs[1])
      : moduleDef?.routes[0];

    if (!moduleDef || !routeDef) {
      return {
        notFound: true,
      };
    }

    return {
      props: { moduleName: moduleDef.name, routeName: routeDef.name },
    };
  };

  const ModulePage: NextPage<ModulePageProps> = ({ moduleName, routeName }) => {
    const moduleConfig = modules.find(({ name }) => name === moduleName);

    const { id } = useCurrentOcel();
    const { data: ocels, isPending } = useGetOcels();
    const ocel = ocels?.find((log) => log.id === id);
    const route = moduleConfig?.routes.find(({ name }) => name === routeName);
    const RouteComponent = route?.component;

    if (route && !canAccessRoute(route, ocel)) {
      // Not known yet: the logs are still loading, or there are logs and one is
      // about to be selected. Saying "select a compatible log" would be premature.
      if (isPending || (!ocel && (ocels?.length ?? 0) > 0)) {
        return null;
      }

      return (
        <Alert title="Compatible OCEL required">
          Select a compatible log to use this page.
        </Alert>
      );
    }

    return RouteComponent ? <RouteComponent /> : null;
  };

  return { getStaticPaths, getStaticProps, ModulePage };
};
