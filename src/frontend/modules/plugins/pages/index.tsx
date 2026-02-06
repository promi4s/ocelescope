import { defineModuleRoute } from "@/lib/modules";
import { useRouter } from "next/router";
import PluginsOverview from "./PluginsOverview";
import PluginPage from "./PluginPage";
import MethodPage from "./MethodPage";

const PluginRoute = () => {
  const { query } = useRouter();
  const { pluginId, methodName } = query;

  if (pluginId) {
    if (methodName) {
      return (
        <MethodPage
          methodName={methodName as string}
          pluginId={pluginId as string}
        />
      );
    }
    return <PluginPage pluginId={pluginId as string} />;
  }

  return <PluginsOverview />;
};

export default defineModuleRoute({
  name: "plugins",
  label: "Plugins",
  component: PluginRoute,
});
