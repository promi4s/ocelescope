import { createContext, type ReactNode, useContext, useMemo } from "react";
import type { PluginFormData, PluginInputResources } from "./types";

type PluginFormContextValue = {
  pluginId: string;
  methodName: string;
  inputResources: PluginInputResources;
  configuration: PluginFormData;
};

const PluginFormContext = createContext<PluginFormContextValue | undefined>(
  undefined,
);

export const usePluginForm = () => {
  const context = useContext(PluginFormContext);

  if (!context) {
    throw new Error(
      "Custom plugin fields have to be rendered inside <PluginFormProvider>",
    );
  }

  return context;
};

export const PluginFormProvider: React.FC<
  PluginFormContextValue & { children: ReactNode }
> = ({ pluginId, methodName, inputResources, configuration, children }) => {
  const value = useMemo(
    () => ({ pluginId, methodName, inputResources, configuration }),
    [pluginId, methodName, inputResources, configuration],
  );

  return (
    <PluginFormContext.Provider value={value}>
      {children}
    </PluginFormContext.Provider>
  );
};
