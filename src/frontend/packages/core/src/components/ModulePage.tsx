import type { GetStaticPaths, GetStaticProps, NextPage } from "next";
import type { OcelescopeConfig } from "../lib/config";

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

    const RouteComponent = moduleConfig?.routes.find(
      ({ name }) => name === routeName,
    )?.component;

    return RouteComponent ? <RouteComponent /> : null;
  };

  return { getStaticPaths, getStaticProps, ModulePage };
};
