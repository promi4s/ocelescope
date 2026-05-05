import { Badge } from "@mantine/core";

export const AnnotationBadge = () => (
  <Badge
    size="xs"
    variant="filled"
    color="gray"
    title="This graph element has an annotation visualization."
    style={{ pointerEvents: "none" }}
  >
    i
  </Badge>
);
