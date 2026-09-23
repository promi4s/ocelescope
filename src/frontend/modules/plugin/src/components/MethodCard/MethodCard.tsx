import { Group, Stack, Text } from "@mantine/core";
import type { MethodApi } from "@ocelescope/api-base";
import { getModuleRoute } from "@ocelescope/core";
import { ArrowRightIcon } from "lucide-react";
import {
  LinkCard,
  LinkCardDescription,
  LinkCardTitle,
  ResourceTypeOverflowList,
} from "../LinkCard/LinkCard";

export const METHOD_CARD_HEIGHT = 240;

const getResourceTypes = (ios: MethodApi["inputs"]) =>
  Array.from(
    new Set(ios.map((io) => (io.type === "ocel" ? "OCEL" : io.resource_label))),
  );

const IOColumn: React.FC<{ label: string; resourceTypes: string[] }> = ({
  label,
  resourceTypes,
}) => (
  <Stack gap={6} flex={1} miw={0}>
    <Text size="xs" fw={600} tt="uppercase" c="dimmed">
      {label}
    </Text>
    {resourceTypes.length > 0 ? (
      <ResourceTypeOverflowList resourceTypes={resourceTypes} maxRows={2} />
    ) : (
      <Text size="xs" c="dimmed">
        None
      </Text>
    )}
  </Stack>
);

export const MethodCard: React.FC<{ pluginId: string; method: MethodApi }> = ({
  pluginId,
  method,
}) => {
  const href = getModuleRoute({
    moduleName: "plugins",
    routeName: "plugins",
    query: { pluginId, methodName: method.name },
  });

  return (
    <LinkCard href={href} height={METHOD_CARD_HEIGHT}>
      <LinkCardTitle href={href} label={method.label ?? method.name} />
      <LinkCardDescription description={method.description} />

      <Group mt={"auto"} align="start" wrap="nowrap" gap="xs">
        <IOColumn
          label="Input"
          resourceTypes={getResourceTypes(method.inputs)}
        />
        <ArrowRightIcon
          size={16}
          style={{ flexShrink: 0, marginTop: 20, opacity: 0.5 }}
        />
        <IOColumn
          label="Output"
          resourceTypes={getResourceTypes(method.outputs)}
        />
      </Group>
    </LinkCard>
  );
};
