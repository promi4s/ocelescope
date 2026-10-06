import { Center, Text } from "@mantine/core";
import type { GetStaticPaths, GetStaticProps, NextPage } from "next";
import { useOcelRequirement } from "../hooks/useOcelRequirement";
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

    const route = moduleConfig?.routes.find(({ name }) => name === routeName);
    const RouteComponent = route?.component;
    const isRequirementMet = useOcelRequirement();

    // a page for an OCEL extension is not shown a log of another kind
    if (
      Array.isArray(route?.requiresOcel) &&
      !isRequirementMet(route.requiresOcel)
    ) {
      return (
        <Center h="100%">
          <Text c="dimmed">This page does not support the selected log.</Text>
        </Center>
      );
    }

    return RouteComponent ? <RouteComponent /> : null;
  };

  return { getStaticPaths, getStaticProps, ModulePage };
};
