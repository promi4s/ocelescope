import { LoadingOverlay } from "@mantine/core";
import type { ComponentProps } from "react";

const CytoscapeLoadingSpinner = (
  props: ComponentProps<typeof LoadingOverlay>,
) => <LoadingOverlay zIndex={1} {...props} />;

export default CytoscapeLoadingSpinner;
