import { useGetComputedValues } from "@/api/fastapi/plugins/plugins";
import { PluginInputType } from "@/components/Plugins/Form";
import { keepPreviousData } from "@tanstack/react-query";
import { useWatch, Control } from "react-hook-form";

type useSelectOptionsProps = {
  pluginName: string;
  methodName: string;
  provider: string;
  control: Control<PluginInputType>;
};

export const useSelectOptions = ({
  pluginName,
  methodName,
  provider,
  control,
}: useSelectOptionsProps) => {
  const formValues = useWatch({ control }); // watches the whole form

  // Orval uses the first arg to build the query key, so passing formValues here
  // makes it refetch automatically on any change.
  const { data } = useGetComputedValues(
    pluginName,
    methodName,
    provider,
    {
      input: formValues.input,
      input_ocels: Object.fromEntries(
        Object.entries(formValues.input_ocels ?? {}).filter(
          ([_, v]) => !!v && v.length >= 0,
        ),
      ) as PluginInputType["input_ocels"],
      input_resources: Object.fromEntries(
        Object.entries(formValues.input_resources ?? {}).filter(
          ([_, v]) => !!v && v.length >= 0,
        ),
      ) as PluginInputType["input_resources"],
    },
    {
      query: {
        placeholderData: keepPreviousData,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
      },
    },
  );

  return { options: data };
};
