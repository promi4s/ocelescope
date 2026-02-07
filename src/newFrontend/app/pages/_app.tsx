import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { OcelescopeProvider } from "@ocelescope/core";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <OcelescopeProvider pageProps={pageProps}>
      <Component {...pageProps} />
    </OcelescopeProvider>
  );
}
