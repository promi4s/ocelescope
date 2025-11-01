import {
  useGetPlugin,
  useGetPluginMethod,
} from "@/api/fastapi/plugins/plugins";
import PluginInput from "@/components/Plugins/Form";
import ResultSection from "@/components/Plugins/ResultSection/ResultSection";
import {
  Anchor,
  Breadcrumbs,
  Container,
  LoadingOverlay,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

const PluginPage = () => {
  const router = useRouter();
  const { id, method } = router.query;

  const { data: pluginMethod, isLoading } = useGetPluginMethod(
    id as string,
    method as string,
  );

  const { data: plugin } = useGetPlugin(id as string);

  useEffect(() => {
    if (!pluginMethod && !isLoading) {
      router.push("/plugins");
    }
  }, [isLoading, pluginMethod]);

  const [currentTask, setCurrentTask] = useState<string>();

  if (!pluginMethod) {
    return <LoadingOverlay visible={true} />;
  }

  return (
    <Container>
      <Stack gap={"xl"}>
        <Stack align="center">
          <Breadcrumbs>
            {[
              <Anchor component={Link} href="/plugins">
                Plugins
              </Anchor>,
              <Anchor component={Link} href={`/plugins/${id}`}>
                {plugin?.meta.label}
              </Anchor>,
              <Anchor component={Link} href={`/plugins/${id}`}>
                {pluginMethod.label}
              </Anchor>,
            ]}
          </Breadcrumbs>
          <Stack gap={0}>
            <Title ta={"center"}>{pluginMethod?.label ?? method}</Title>
            {pluginMethod?.description && (
              <Text c="dimmed">{pluginMethod?.description}</Text>
            )}
          </Stack>
        </Stack>
        <PluginInput
          onSuccess={setCurrentTask}
          pluginId={id as string}
          method={pluginMethod}
        />
        <ResultSection taskId={currentTask} />
      </Stack>
    </Container>
  );
};

export default PluginPage;
