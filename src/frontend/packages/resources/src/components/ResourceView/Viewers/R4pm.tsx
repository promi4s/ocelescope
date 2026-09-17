import { Box } from "@mantine/core";
import dynamic from "next/dynamic";
import type { ComponentType, ReactNode } from "react";

type R4pmComponents = typeof import("@r4pm/components");

export const r4pmViewer = <P extends object>(
  pick: (components: R4pmComponents) => ComponentType<P>,
) =>
  dynamic<P>(
    async () => {
      const [components, { wasmLayout }] = await Promise.all([
        import("@r4pm/components"),
        import("@r4pm/components/rust-layout/wasm"),
      ]);
      const { ViewerConfigProvider } = components;
      const Viewer = pick(components);
      const viewerConfig = { layout: wasmLayout };

      return (props: P) => (
        <ViewerConfigProvider value={viewerConfig}>
          <Viewer {...props} />
        </ViewerConfigProvider>
      );
    },
    { ssr: false },
  );

const ExportFrame = dynamic(
  () => import("@r4pm/components").then((c) => c.ViewerExportFrame),
  { ssr: false },
);

export const R4pmViewerContainer = ({
  filename,
  children,
}: {
  filename: string;
  children: ReactNode;
}) => (
  <Box h="100%" w="100%" pos="relative" style={{ overflow: "hidden" }}>
    <ExportFrame filename={filename} style={{ height: "100%" }}>
      {children}
    </ExportFrame>
  </Box>
);
