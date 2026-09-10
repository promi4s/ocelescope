/** Ids of the resources a plugin method runs on, keyed by input name. */
export type PluginInputResources = {
  [inputName: string]: string | null | undefined;
};

/** Values of a plugin method's configuration schema. */
export type PluginFormData = { [key: string]: any };
