import { usePlugins } from "@/api/fastapi/plugins/plugins";
import { PluginCard, UploadPluginCard } from "@/components/Plugins/Card/Card";
import { SimpleGrid } from "@mantine/core";

const PluginOverview: React.FC = () => {
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

export default PluginOverview;
