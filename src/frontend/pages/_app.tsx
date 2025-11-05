import "@mantine/core/styles.css";
import "mantine-datatable/styles.css";
import "@mantine/carousel/styles.css";
import "@mantine/dates/styles.css";
import "@mantine/charts/styles.css";
import "@mantine/notifications/styles.css";
import "@mantine/dropzone/styles.css";
import "@mantine/notifications/styles.css";
import "@xyflow/react/dist/style.css";
import "@/styles/floating-flow.css";

import { Notifications } from "@mantine/notifications";

import Head from "next/head";
import { MantineProvider } from "@mantine/core";
import { theme } from "../theme";
import { useState } from "react";

import {
  HydrationBoundary,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import AppShell from "@/components/AppShell/AppShell";
import { NotificationProvider } from "@/components/TaskNotification/TaskNotificationProvider";
import SSEWrapper from "@/components/SSEWrapper/SSEWrapper";

export default function App({ Component, pageProps }: any) {
  const [client] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={client}>
      <HydrationBoundary>
        <MantineProvider theme={theme}>
          <Notifications />
          <Head>
            <title>Ocelescope</title>
            <meta
              name="viewport"
              content="minimum-scale=1, initial-scale=1, width=device-width, user-scalable=no"
            />
            <link rel="shortcut icon" href="/favicon.svg" />
          </Head>
          <SSEWrapper />
          <NotificationProvider>
            <AppShell>
              <Component {...pageProps} />
            </AppShell>
          </NotificationProvider>
        </MantineProvider>
      </HydrationBoundary>
      <ReactQueryDevtools />
    </QueryClientProvider>
  );
}
