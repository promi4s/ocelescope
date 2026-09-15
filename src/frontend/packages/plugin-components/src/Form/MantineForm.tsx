import type RJSFForm from "@rjsf/core";
import type { FormProps } from "@rjsf/core";
import dynamic from "next/dynamic";
import type { Ref } from "react";

export type MantineFormProps = FormProps & { formRef?: Ref<RJSFForm> };

export const Form = dynamic<MantineFormProps>(
  () =>
    import("@rjsf/mantine").then(({ Form: RJSFMantineForm }) => {
      const MantineForm = ({ formRef, ...props }: MantineFormProps) => (
        <RJSFMantineForm ref={formRef} {...props} />
      );
      return MantineForm;
    }),
  { ssr: false },
);
