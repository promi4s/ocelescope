import moduleMap from "@/lib/modules/module-map";
import { ModuleName, ModuleRouteName } from "@/types/modules";
import { useRouter } from "next/router";

const useModulePath = () => {
  const router = useRouter();
  const { slug } = router.query;
  const name = slug?.[0];

  if (!name || !(name in moduleMap)) return;

  const moduleEntry = moduleMap[name as ModuleName];

  return {
    name: moduleEntry.name as ModuleName,
    route: Object.values(moduleEntry.routes).find(
      ({ name }) => name === slug?.[1],
    )?.name as ModuleRouteName<ModuleName>,
  };
};

export default useModulePath;
