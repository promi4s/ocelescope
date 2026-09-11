export type Entity = {
  type: "ocel" | "resource";
  entityTypeName: string;
  id: string;
  name: string;
  /** ISO timestamp, formatted for display in the table */
  createdAt: string;
  isFiltered?: boolean;
  isUploading?: boolean;
};
