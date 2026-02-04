import type OcelescopeConfig from "@/types/ocelescope";
import type { GetStaticPaths, GetStaticProps, NextPage } from "next";

type ModulePageProps = {
  moduleName: string;
  routeName: string;
};

const createModulesPage = (config: OcelescopeConfig) => {
  const getStaticPaths: GetStaticPaths = async () => {
    const paths = config.modules.flatMap(({ name: moduleName, routes }) =>
      routes.map(({ name: routeName }) => ({
        params: { slug: [moduleName, routeName] },
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
    const slugs = params?.slug ?? [];

    const moduleConfig = config.modules.find(({ name }) => name === slugs[0]);
    const routeName = moduleConfig?.routes.find(
      ({ name }) => name === slugs[1],
    )?.name;

    if (!(moduleConfig && routeName)) {
      return {
        notFound: true,
      };
    }

    return {
      props: {
        moduleName: moduleConfig.name,
        routeName,
      },
    };
  };

  const ModulePage: NextPage<ModulePageProps> = ({ moduleName, routeName }) => {
    const moduleConfig = config.modules.find(({ name }) => name === moduleName);

    const RouteComponent = moduleConfig?.routes.find(
      ({ name }) => name === routeName,
    )?.component;

    return RouteComponent ? <RouteComponent /> : <div>Module not found</div>;
  };

  return { getStaticPaths, getStaticProps, ModulePage };
};

export default createModulesPage;
