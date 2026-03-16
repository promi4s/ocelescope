import { defineModuleRoute } from "@ocelescope/core";
import { useRouter } from "next/router";
import MethodPage from "./MethodPage";
import PluginPage from "./PluginPage";
import PluginsOverview from "./PluginsOverview";

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
