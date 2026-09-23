import {
  CloseButton,
  ScrollArea,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { type MethodApi, useGetPlugin } from "@ocelescope/api-base";
import { SearchIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { MethodCard } from "../components/MethodCard/MethodCard";
import PluginBreadcrumbs from "../components/PluginBreadcrumbs/PluginBreadcrumbs";

const matchesSearch = (method: MethodApi, search: string) =>
  [
    method.name,
    method.label,
    method.description,
    ...[...method.inputs, ...method.outputs].map((io) =>
      io.type === "ocel" ? "OCEL" : io.resource_label,
    ),
  ].some((value) => value?.toLowerCase().includes(search));

const PluginPage: React.FC<{ pluginId: string }> = ({ pluginId }) => {
  const { data: plugin } = useGetPlugin(pluginId);
  const [search, setSearch] = useState("");

  const filteredMethods = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return (plugin?.methods ?? []).filter((method) =>
      matchesSearch(method, normalizedSearch),
    );
  }, [plugin, search]);

  return (
    <Stack gap={0} p="md" h="100%">
      <Stack gap={0} align="center">
        <PluginBreadcrumbs />
        <Title mt={"xs"}> {plugin?.label}</Title>
        <Text c="dimmed">{plugin?.description}</Text>
      </Stack>

      <TextInput
        mt="md"
        placeholder="Search methods by name, description or resource type"
        leftSection={<SearchIcon size={16} />}
        rightSection={
          search && (
            <CloseButton
              size="sm"
              aria-label="Clear search"
              onClick={() => setSearch("")}
            />
          )
        }
        value={search}
        onChange={(event) => setSearch(event.currentTarget.value)}
      />

      {plugin && filteredMethods.length === 0 ? (
        <Text c="dimmed" ta="center" mt="xl">
          {search.trim()
            ? `No methods match "${search.trim()}".`
            : "This plugin has no methods."}
        </Text>
      ) : (
        <ScrollArea flex={1} mih={0} mt="sm" type="auto" offsetScrollbars>
          {/* Padding keeps the cards' hover shadow from being clipped by the scroll container */}
          <SimpleGrid
            p="xs"
            cols={{ base: 1, sm: 2, lg: 3 }}
            spacing={{ base: 10, sm: "xl" }}
            verticalSpacing={{ base: "md", sm: "xl" }}
          >
            {plugin &&
              filteredMethods.map((method) => (
                <MethodCard
                  method={method}
                  key={method.name}
                  pluginId={plugin.id}
                />
              ))}
          </SimpleGrid>
        </ScrollArea>
      )}
    </Stack>
  );
};

export default PluginPage;
