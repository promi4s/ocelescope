import { createTheme, MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { Theme } from "@r4pm/components/ui";
import {
  HydrationBoundary,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState } from "react";
import type { OcelescopeConfig } from "../lib/config";
import { AppShell } from "./AppShell/AppShell";
import SSEWrapper from "./SSEWrapper";

const theme = createTheme({
  fontWeights: { medium: "500" },
});

export const OcelescopeApp: (config: OcelescopeConfig) => React.FC<any> =
  (config) =>
  ({ Component, pageProps }) => {
    const [client] = useState(() => new QueryClient());

    return (
      <QueryClientProvider client={client}>
        <HydrationBoundary state={pageProps.dehydratedState}>
          <MantineProvider theme={theme}>
            <Theme>
              <SSEWrapper />
              <Notifications />
              <AppShell config={config}>
                <Component {...pageProps} />
              </AppShell>
            </Theme>
          </MantineProvider>
        </HydrationBoundary>
        <ReactQueryDevtools />
      </QueryClientProvider>
    );
  };
