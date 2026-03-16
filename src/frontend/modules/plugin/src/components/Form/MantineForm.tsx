import dynamic from "next/dynamic";

export const Form = dynamic(() => import("@rjsf/mantine").then((m) => m.Form), {
  ssr: false,
});
