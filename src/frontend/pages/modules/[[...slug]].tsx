import type { GetStaticPaths, GetStaticProps, NextPage } from "next";

import moduleMap from "@/lib/modules/module-map";
import type { ModuleName, ModuleRouteName } from "@/types/modules";

type ModulePageProps = {
  module: {
    name: ModuleName;
    componentPath: string;
  };
};

export const getStaticPaths: GetStaticPaths = async () => {
  const paths = Object.entries(moduleMap).flatMap(([moduleName, module]) =>
    Object.keys(module.routes).map((name) => ({
      params: { slug: [moduleName, name] },
    })),
  );

  return {
    paths: [...paths, { params: { slug: [] } }],
    fallback: false,
  };
};

export const getStaticProps: GetStaticProps<ModulePageProps> = async ({
  params,
}) => {
  const slugs = params?.slug ?? [];

  if (!Array.isArray(slugs) && slugs.length >= 2) {
    return { notFound: true };
  }

  const moduleName = slugs[0];

  if (!(moduleName in moduleMap)) {
    return { notFound: true };
  }

  const moduleKey = moduleName as ModuleName;

  const routeName = slugs[1];

  const componentPath =
    routeName in moduleMap[moduleKey].routes
      ? (routeName as ModuleRouteName<typeof moduleKey>)
      : undefined;

  if (!componentPath) {
    return { notFound: true };
  }

  return {
    props: {
      module: {
        name: moduleKey,
        componentPath,
      },
    },
  };
};

// Actual page component
const ModulePage: NextPage<ModulePageProps> = ({ module }) => {
  const Component = Object.values(moduleMap[module.name].routes).find(
    ({ name }) => {
      return name === module.componentPath;
    },
  )?.component;

  return Component ? <Component /> : <div>Module not found</div>;
};

export default ModulePage;
