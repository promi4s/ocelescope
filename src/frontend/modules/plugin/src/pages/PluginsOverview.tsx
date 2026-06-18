import { Anchor, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { usePlugins } from "@ocelescope/api-base";
import { env } from "@ocelescope/core";
import {
  PluginCard,
  UploadPluginCard,
} from "../components/PluginCard/PluginCard";
import { PluginUploadSection } from "../components/PluginUploadSection/PluginUploadSection";

const PluginsOverview: React.FC = () => {
  const { data: plugins } = usePlugins();

  return (
    <Stack gap="md">
      <div style={{ maxWidth: 720 }}>
        <Title order={2}>Plugin Overview</Title>
        <Text c="dimmed" size="sm" mt={4}>
          Upload plugins to extend Ocelescope with custom process mining
          functionality. Plugins are packaged as .zip files. Documentation for
          writing your own plugins is available on the{" "}
          <Anchor
            href={env.projectPage}
            target="_blank"
            rel="noopener noreferrer"
          >
            project page
          </Anchor>
          .
        </Text>
      </div>

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
