import type { GetStaticPaths, GetStaticProps, NextPage } from "next";
import type { OcelescopeConfig } from "../lib/config";
import DefaultHomePage from "./DefaultHomePage/DefaultHomePage";

type ModulePageProps = {
  moduleProps?: {
    moduleName: string;
    routeName: string;
  };
};

export const createModulesPage = (config: OcelescopeConfig) => {
  const { modules = [], homePage: HomePage = DefaultHomePage } = config;

  const getStaticPaths: GetStaticPaths = async () => {
    const paths = modules.flatMap(({ name: moduleName, routes }) =>
      routes.map(({ name: routeName }) => ({
        params: { slug: ["modules", moduleName, routeName] },
      })),
    );

    return {
      paths: [...paths, { params: { slug: [] } }],
      fallback: false,
    };
  };

  const getStaticProps: GetStaticProps<ModulePageProps> = async ({
    params,
  }) => {
    //TODO: Fix Error
    const slugs: string[] = (params?.slug as string[]) ?? [];

    const moduleConfig = modules.find(({ name }) => name === slugs[1]);
    const routeName = moduleConfig?.routes.find(
      ({ name }) => name === slugs[2],
    )?.name;

    return moduleConfig && routeName
      ? { props: { moduleProps: { moduleName: moduleConfig.name, routeName } } }
      : { props: {} };
  };

  const ModulePage: NextPage<ModulePageProps> = ({ moduleProps }) => {
    const moduleConfig = modules.find(
      ({ name }) => name === moduleProps?.moduleName,
    );

    const RouteComponent = moduleConfig?.routes.find(
      ({ name }) => name === moduleProps?.routeName,
    )?.component;

    return RouteComponent ? <RouteComponent /> : <HomePage />;
  };

  return { getStaticPaths, getStaticProps, ModulePage };
};
