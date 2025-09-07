import { usePlugins } from "@/api/fastapi/plugins/plugins";
import { PluginCard } from "@/components/Plugins/Card/Card";
import { Container, SimpleGrid } from "@mantine/core";

const PluginOverview: React.FC = () => {
  const { data: plugins = [] } = usePlugins();

  return (
    <Container pos={"relative"} h={"100%"}>
      <SimpleGrid
        cols={{ base: 1, sm: 2, lg: 5 }}
        spacing={{ base: 10, sm: "xl" }}
        verticalSpacing={{ base: "md", sm: "xl" }}
      >
        {plugins.map((plugin) => (
          <PluginCard key={plugin.id} plugin={plugin} />
        ))}
      </SimpleGrid>
    </Container>
  );
};

export default PluginOverview;
