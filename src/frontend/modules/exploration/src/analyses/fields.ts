import type { VisualizationSpec } from "../model/dashboard";
import type { Sources } from "./sources";

/**
 * Editors are declared, not written. Every analysis editor was the same
 * component — cascading selects, an optional number, a title, submit — so the
 * only thing worth keeping per analysis is what makes it different.
 */

export type FieldValue = string | string[] | number | null;
export type FieldValues = Record<string, FieldValue>;

export interface FieldContext {
  sources: Sources;
  values: FieldValues;
}

export interface Option {
  value: string;
  label: string;
}

interface CommonField {
  key: string;
  label: string;
  description?: string | ((context: FieldContext) => string | undefined);
  /**
   * Keys this field reads. When one of them changes, this field is cleared —
   * which is what keeps a cascade consistent without per-editor reset code.
   */
  dependsOn?: string[];
  /** Hidden fields are neither rendered nor required. */
  visibleIf?: (context: FieldContext) => boolean;
  optional?: boolean;
  /** Shown when the field has no options yet because a parent is unset. */
  waitingFor?: string;
}

export interface SelectField extends CommonField {
  kind: "select";
  options: (context: FieldContext) => Array<Option | string>;
  searchable?: boolean;
  /** Feeds the object-id search box rather than filtering locally. */
  remoteSearch?: boolean;
}

export interface MultiSelectField extends CommonField {
  kind: "multiselect";
  options: (context: FieldContext) => Array<Option | string>;
  placeholder?: string;
  /** Start with everything selected once the options have loaded. */
  selectAllByDefault?: boolean;
}

export interface NumberField extends CommonField {
  kind: "number";
  min: number;
  max: number;
  initial: number;
}

export interface TextField extends CommonField {
  kind: "text";
  placeholder?: string | ((context: FieldContext) => string);
}

export type Field = SelectField | MultiSelectField | NumberField | TextField;

export type QueryObject = Record<string, unknown>;

export interface AnalysisForm {
  fields: Field[];
  /**
   * Field keys are query parameter names, so the stored spec is derived rather
   * than hand-written. `title` and `visualization` are the two keys that live
   * outside `query`; everything else goes in.
   */
  query?: (
    derived: QueryObject,
    values: FieldValues,
    context: FieldContext,
  ) => QueryObject;
  /** Only for values a query cannot round-trip on its own. */
  values?: (spec: VisualizationSpec) => Partial<FieldValues>;
}

/** Keys that are part of the card, not of the backend query. */
const OUTSIDE_QUERY = new Set(["title", "visualization"]);

/** Values of every field that names a query parameter. */
function derivedQuery(form: AnalysisForm, values: FieldValues): QueryObject {
  const query: QueryObject = {};
  for (const field of form.fields) {
    if (OUTSIDE_QUERY.has(field.key)) continue;
    query[field.key] = values[field.key];
  }
  return query;
}

/**
 * Assembles the stored spec. One cast, here, instead of one per analysis: the
 * field schema has already guaranteed every value is present and allowed.
 */
export function buildSpec(
  analysis: VisualizationSpec["analysis"],
  form: AnalysisForm,
  values: FieldValues,
  context: FieldContext,
): VisualizationSpec {
  const base = derivedQuery(form, values);
  const query = form.query ? form.query(base, values, context) : base;
  const visualization = text(values, "visualization");
  const title = text(values, "title")?.trim();

  return {
    analysis,
    ...(Object.keys(query).length > 0 ? { query } : {}),
    ...(visualization ? { visualization } : {}),
    ...(title ? { title } : {}),
  } as unknown as VisualizationSpec;
}

/** The inverse, for reopening a card. */
export function specToValues(
  form: AnalysisForm,
  spec: VisualizationSpec,
): Partial<FieldValues> {
  const query = ("query" in spec ? spec.query : {}) as Partial<FieldValues>;
  return {
    ...query,
    ...("visualization" in spec ? { visualization: spec.visualization } : {}),
    title: spec.title ?? "",
    ...form.values?.(spec),
  };
}

/* -------------------------------------------------------------------------- */
/* Helpers used by the renderer and by the schemas                            */
/* -------------------------------------------------------------------------- */

export const asOption = (option: Option | string): Option =>
  typeof option === "string" ? { value: option, label: option } : option;

export const isVisible = (field: Field, context: FieldContext): boolean =>
  field.visibleIf?.(context) ?? true;

export const text = (values: FieldValues, key: string): string | null => {
  const value = values[key];
  return typeof value === "string" && value !== "" ? value : null;
};

export const number = (values: FieldValues, key: string): number | null => {
  const value = values[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
};

export const list = (values: FieldValues, key: string): string[] => {
  const value = values[key];
  return Array.isArray(value) ? value : [];
};

/**
 * A field is satisfied when it holds a value its own options still allow.
 * Checking membership rather than trusting the stored value is what removed the
 * hand-written "is this pair still valid?" predicate from every editor.
 */
export function isSatisfied(field: Field, context: FieldContext): boolean {
  if (!isVisible(field, context)) return true;
  if (field.optional) return true;

  switch (field.kind) {
    case "select": {
      const value = text(context.values, field.key);
      if (value == null) return false;
      return field
        .options(context)
        .some((option) => asOption(option).value === value);
    }
    case "multiselect":
      return list(context.values, field.key).length > 0;
    case "number": {
      const value = number(context.values, field.key);
      return value != null && value >= field.min && value <= field.max;
    }
    case "text":
      return true;
  }
}

export const isComplete = (fields: Field[], context: FieldContext): boolean =>
  fields.every((field) => isSatisfied(field, context));

/** Initial form state, seeded from an existing card when editing. */
export function initialValues(
  form: AnalysisForm,
  initial: VisualizationSpec | undefined,
  analysis: VisualizationSpec["analysis"],
): FieldValues {
  const seed =
    initial && initial.analysis === analysis ? specToValues(form, initial) : {};
  const values: FieldValues = {};
  for (const field of form.fields) {
    values[field.key] =
      seed[field.key] ??
      (field.kind === "number"
        ? field.initial
        : field.kind === "multiselect"
          ? []
          : field.kind === "text"
            ? ""
            : null);
  }
  return values;
}

/** Clearing dependants keeps a cascade from holding a stale selection. */
export function applyChange(
  fields: Field[],
  values: FieldValues,
  key: string,
  value: FieldValue,
): FieldValues {
  const next: FieldValues = { ...values, [key]: value };
  for (const field of fields) {
    if (!field.dependsOn?.includes(key)) continue;
    next[field.key] =
      field.kind === "multiselect" ? [] : field.kind === "text" ? "" : null;
  }
  return next;
}
