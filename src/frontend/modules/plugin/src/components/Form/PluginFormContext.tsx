import { createContext, type ReactNode, useContext, useMemo } from "react";
import { type Control, useWatch } from "react-hook-form";
import type { PluginInputType } from ".";

type PluginFormContextValue = {
  pluginId: string;
  methodName: string;
  control: Control<PluginInputType>;
};

const PluginFormContext = createContext<PluginFormContextValue | undefined>(
  undefined,
);

const usePluginForm = () => {
  const context = useContext(PluginFormContext);

  if (!context) {
    throw new Error(
      "Custom plugin fields have to be rendered inside <PluginFormProvider>",
    );
  }

  return context;
};

export const useOcelId = (ocelRef: string) => {
  const { control } = usePluginForm();

  return useWatch({ control, name: `input_ocels.${ocelRef}` });
};

export const PluginFormProvider: React.FC<
  PluginFormContextValue & { children: ReactNode }
> = ({ pluginId, methodName, control, children }) => {
  const value = useMemo(
    () => ({ pluginId, methodName, control }),
    [pluginId, methodName, control],
  );

  return (
    <PluginFormContext.Provider value={value}>
      {children}
    </PluginFormContext.Provider>
  );
};
