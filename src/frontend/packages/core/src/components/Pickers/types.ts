/** Picking one value, or none. */
export interface SingleSelection<T> {
  multiple?: false;
  value: T | null | undefined;
  onChange: (value: T | undefined) => void;
}

/** Picking any number of values. */
export interface MultiSelection<T> {
  multiple: true;
  value: readonly T[];
  onChange: (value: T[]) => void;
}

/** What a picker picks. Single unless `multiple` is set. */
export type Selection<T> = SingleSelection<T> | MultiSelection<T>;

/** How a picker looks and reads, whatever it picks. */
export interface PickerProps {
  /**
   * `"dropdown"` (default) is a compact field that opens a searchable list,
   * for forms. `"list"` shows every choice at once, with frequency bars, for
   * side panels and filters.
   */
  variant?: "dropdown" | "list";
  label?: string;
  /** A line of help under the label. */
  description?: string;
  /** Trigger text of the dropdown while nothing is picked. */
  placeholder?: string;
  /** Shown when there is nothing to pick from. */
  emptyText?: string;
  disabled?: boolean;
  /** Focus the search on mount (list), or open the dropdown on mount. */
  autoFocus?: boolean;
  /** The count beside each choice. */
  counts?: boolean;
  /** List only: a bar behind each choice, as long as its share of the largest count. */
  bars?: boolean;
  /** List only: the rail that drags a cut through the list, taking the top choices. */
  cutoff?: boolean;
  sort?: "count" | "name";
}

/** Which OCEL a picker reads its choices from. */
export interface OcelSource {
  /** Defaults to the OCEL the app has selected. */
  ocelId?: string;
  /** The unfiltered log, for choices that must not shift under a filter. */
  ocelVersion?: "filtered" | "original";
}

/** The props of a picker that reads its choices from an OCEL endpoint. */
export type OcelPickerProps<T> = OcelSource & PickerProps & Selection<T>;

/** How events of a type, or objects of a type, relate to objects of a type. */
export interface Relation {
  /** The event type (E2O) or object type (O2O) the relation starts from. */
  source: string;
  /** The object type it points to. */
  target: string;
  qualifier: string;
}

/** An attribute of an activity's events, or of an object type's objects. */
export type AttributeRef =
  | { target: "event"; activity: string; name: string }
  | { target: "object"; objectType: string; name: string };
