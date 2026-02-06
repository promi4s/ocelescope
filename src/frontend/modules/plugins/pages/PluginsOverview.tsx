import { usePlugins } from "@/api/fastapi/plugins/plugins";
import { SimpleGrid } from "@mantine/core";
import {
  PluginCard,
  UploadPluginCard,
} from "../components/PluginCard/PluginCard";

const PluginsOverview: React.FC = () => {
  const { data: plugins = [] } = usePlugins();

  return (
    <SimpleGrid
      cols={{ base: 1, sm: 2, md: 3, lg: 3 }}
      spacing={{ base: 10, sm: "xl" }}
      verticalSpacing={{ base: "md", sm: "xl" }}
    >
      {plugins.map((plugin) => (
        <PluginCard key={plugin.id} plugin={plugin} />
      ))}
      <UploadPluginCard />
    </SimpleGrid>
  );
};

export default PluginsOverview;
