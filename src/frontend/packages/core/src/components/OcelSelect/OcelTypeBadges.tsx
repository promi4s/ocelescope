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
    {extensions.map(({ name, label }) => (
      <Badge key={name} color={generateColor(name)}>
        {label}
      </Badge>
    ))}
  </Group>
);
