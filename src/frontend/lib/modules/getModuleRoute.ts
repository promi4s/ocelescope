const getModuleRoute = ({
  moduleName,
  routeName,
}: { moduleName: string; routeName: string }) => {
  return `/modules/${moduleName}/${routeName}`;
};

export default getModuleRoute;
