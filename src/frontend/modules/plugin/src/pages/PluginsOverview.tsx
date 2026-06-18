import { SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { usePlugins } from "@ocelescope/api-base";
import {
  PluginCard,
  UploadPluginCard,
} from "../components/PluginCard/PluginCard";
import { PluginUploadSection } from "../components/PluginUploadSection/PluginUploadSection";

const PluginsOverview: React.FC = () => {
  const { data: plugins } = usePlugins();

  return (
    <Stack>
      <Title order={2}>Plugin Overview</Title>
      <Text></Text>
      {plugins && plugins.length === 0 ? (
        <PluginUploadSection />
      ) : (
        <SimpleGrid
          cols={{ base: 1, sm: 2, md: 3, lg: 3 }}
          spacing={{ base: 10, sm: "xl" }}
          verticalSpacing={{ base: "md", sm: "xl" }}
        >
          {plugins?.map((plugin) => (
            <PluginCard key={plugin.id} plugin={plugin} />
          ))}
          <UploadPluginCard />
        </SimpleGrid>
      )}
    </Stack>
  );
};

export default PluginsOverview;
