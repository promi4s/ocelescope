import { usePlugins } from "@/api/fastapi/plugins/plugins";
import { PluginCard } from "@/components/Plugins/Card/Card";
import { SimpleGrid } from "@mantine/core";

const PluginOverview: React.FC = () => {
  const { data: plugins = [] } = usePlugins();

  return (
    <SimpleGrid
      cols={{ base: 1, sm: 2, lg: 4 }}
      spacing={{ base: 10, sm: "xl" }}
      verticalSpacing={{ base: "md", sm: "xl" }}
    >
      {plugins.map((plugin) => (
        <PluginCard key={plugin.id} plugin={plugin} />
      ))}
    </SimpleGrid>
  );
};

export default PluginOverview;
