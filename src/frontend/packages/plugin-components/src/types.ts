export type PluginInputResources = {
  [inputName: string]: string | null | undefined;
};

export type PluginFormData = { [key: string]: any };

export type OcelSelectProps = {
  ocelId: string | null;
  isMulti: boolean;
  theme?: string;
  defaultFrequency?: number;
  value: any;
  onChange: (value: any) => void;
  label?: string;
  description?: string;
  required?: boolean;
  disabled?: boolean;
};
