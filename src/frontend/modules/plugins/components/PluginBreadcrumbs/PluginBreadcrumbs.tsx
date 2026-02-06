import { useGetPlugin } from "@/api/fastapi/plugins/plugins";
import { Anchor, Breadcrumbs } from "@mantine/core";
import Link from "next/link";
import { useRouter } from "next/router";
import { useMemo } from "react";

const PluginBreadcrumbs: React.FC = () => {
  const { query } = useRouter();

  const { pluginId, methodName }: { pluginId?: string; methodName?: string } =
    query;

  const { data: plugin } = useGetPlugin(pluginId ?? "", {
    query: { enabled: !!pluginId },
  });

  const pluginMethod = useMemo(
    () => plugin?.methods.find(({ name }) => name === methodName),
    [plugin, methodName],
  );

  return (
    <Breadcrumbs>
      <Anchor
        component={Link}
        href={{
          query: { ...query, pluginId: undefined, methodName: undefined },
        }}
      >
        Plugins
      </Anchor>
      {plugin && (
        <Anchor
          component={Link}
          href={{
            query: { ...query, pluginId: plugin?.id, methdodName: undefined },
          }}
        >
          {plugin?.meta.label}
        </Anchor>
      )}
      {pluginMethod && (
        <Anchor
          component={Link}
          href={{
            query: {
              ...query,
              pluginId: plugin?.id,
              methodName: pluginMethod.name,
            },
          }}
        >
          {pluginMethod.label ?? pluginMethod.name}
        </Anchor>
      )}
    </Breadcrumbs>
  );
};

export default PluginBreadcrumbs;
