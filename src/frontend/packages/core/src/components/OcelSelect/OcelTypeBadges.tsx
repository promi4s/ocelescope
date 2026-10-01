import { Badge, Group } from "@mantine/core";
import { generateColor } from "@marko19907/string-to-color";
import type { OcelExtensionMetadata } from "@ocelescope/api-base";

export const OcelTypeBadges = ({
  extensions = [],
}: {
  extensions?: OcelExtensionMetadata[];
}) => (
  <Group gap={4}>
    <Badge color={generateColor("OCEL")}>OCEL</Badge>
    {extensions.map(({ id, label }) => (
      <Badge key={id} color={generateColor(id)}>
        {label}
      </Badge>
    ))}
  </Group>
);
