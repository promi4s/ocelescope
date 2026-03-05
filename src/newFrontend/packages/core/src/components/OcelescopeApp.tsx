import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
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

export const OcelescopeApp: (config: OcelescopeConfig) => React.FC<any> =
  (config) =>
  ({ Component, pageProps }) => {
    const [client] = useState(() => new QueryClient());

    return (
      <QueryClientProvider client={client}>
        <HydrationBoundary state={pageProps.dehydratedState}>
          <MantineProvider>
            <SSEWrapper />
            <Notifications />
            <AppShell config={config}>
              <Component {...pageProps} />
            </AppShell>
          </MantineProvider>
        </HydrationBoundary>
        <ReactQueryDevtools />
      </QueryClientProvider>
    );
  };
