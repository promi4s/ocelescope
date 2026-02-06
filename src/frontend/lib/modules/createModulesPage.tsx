import type OcelescopeConfig from "@/types/ocelescope";
import type { GetStaticPaths, GetStaticProps, NextPage } from "next";

type ModulePageProps = {
  moduleProps?: {
    moduleName: string;
    routeName: string;
  };
};

const createModulesPage = (config: OcelescopeConfig) => {
  const getStaticPaths: GetStaticPaths = async () => {
    const paths = config.modules.flatMap(({ name: moduleName, routes }) =>
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
    const slugs: string[] = (params?.slug as string[]) ?? [];

    const moduleConfig = config.modules.find(({ name }) => name === slugs[1]);
    const routeName = moduleConfig?.routes.find(
      ({ name }) => name === slugs[2],
    )?.name;

    return moduleConfig && routeName
      ? { props: { moduleProps: { moduleName: moduleConfig.name, routeName } } }
      : { props: {} };
  };

  const ModulePage: NextPage<ModulePageProps> = ({ moduleProps }) => {
    const moduleConfig = config.modules.find(
      ({ name }) => name === moduleProps?.moduleName,
    );

    const RouteComponent = moduleConfig?.routes.find(
      ({ name }) => name === moduleProps?.routeName,
    )?.component;

    return RouteComponent ? <RouteComponent /> : <config.homePage />;
  };

  return { getStaticPaths, getStaticProps, ModulePage };
};

export default createModulesPage;
