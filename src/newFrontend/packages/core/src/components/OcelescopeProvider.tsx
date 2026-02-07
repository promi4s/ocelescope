import {
  HydrationBoundary,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { useState } from "react";

export const OcelescopeProvider: React.FC<{
  children: React.ReactNode;
  pageProps: any;
}> = ({ children, pageProps }) => {
  const [client] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={client}>
      <HydrationBoundary state={pageProps.dehydratedState}>
        {children}
      </HydrationBoundary>
    </QueryClientProvider>
  );
};
