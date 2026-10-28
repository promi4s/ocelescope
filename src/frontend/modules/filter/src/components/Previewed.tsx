import { Center, Loader, Text } from "@mantine/core";
import type { ReactNode } from "react";

type PreviewQuery<T> = { data?: T; isPending: boolean; error: unknown };

/** Renders ``children`` with the preview data once it is there. */
const Previewed = <T,>({
  query,
  children,
}: {
  query: PreviewQuery<T>;
  children: (data: T) => ReactNode;
}) => {
  if (query.data !== undefined) {
    return children(query.data);
  }
  if (query.error) {
    return (
      <Text c="red" size="sm">
        Could not load the log as the steps before leave it.
      </Text>
    );
  }
  return (
    <Center flex={1} mih={120}>
      <Loader size="sm" />
    </Center>
  );
};

export default Previewed;
