export type RelationGraphKind = "e2o" | "o2o";

export type RelationGraphMode = RelationGraphKind | "both";

export type RelationGraphValue = {
  source: string;
  target: string;
  qualifier: string | null;
};

export type RelationGraphInputProps = {
  ocelId: string;
  viewId: string | null;
  mode: RelationGraphMode;
  value: RelationGraphValue | null;
  onChange: (value: RelationGraphValue | null) => void;
};
