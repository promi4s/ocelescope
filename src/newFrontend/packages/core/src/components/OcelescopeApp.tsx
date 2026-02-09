import { MantineProvider } from "@mantine/core";
import {
  HydrationBoundary,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "./AppShell/AppShell";

export const OcelescopeApp: React.FC<any> = ({ Component, pageProps }) => {
  const [client] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={client}>
      <HydrationBoundary state={pageProps.dehydratedState}>
        <MantineProvider>
          <AppShell>
            <Component />
          </AppShell>
        </MantineProvider>
      </HydrationBoundary>
    </QueryClientProvider>
  );
};
