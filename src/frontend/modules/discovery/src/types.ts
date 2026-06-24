export type DiscoverySchema = {
  properties?: Record<string, DiscoverySchemaProperty>;
  required?: string[];
};

export type DiscoverySchemaProperty = {
  title?: string;
  description?: string;
  type?: string;
  enum?: string[];
  enumNames?: string[];
  items?: DiscoverySchemaProperty;
  default?: unknown;
  minimum?: number;
  maximum?: number;
  fieldType?: string;
};

export type FilterEntry = {
  name: string;
  payload: Record<string, unknown>;
};
