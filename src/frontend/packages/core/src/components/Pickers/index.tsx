import dynamic from "next/dynamic";
import type { ComponentType, JSX } from "react";
import type { OptionPickerProps } from "./OptionPicker";

/**
 * Picking things out of an OCEL: event and object types, events and
 * objects, their attributes, and E2O and O2O relations.
 *
 * Every picker takes the same props: `variant` ("dropdown" or "list"),
 * `multiple`, `value` and `onChange`, `label`, and which OCEL to read
 * (the selected one by default). `OptionPicker` is the presentational core
 * they all wrap around an endpoint; use it for choices from elsewhere.
 */

export type { ActivityPickerProps as EventTypePickerProps } from "./ActivityPicker";
export type { AttributePickerProps } from "./AttributePicker";
export type { E2ORelationPickerProps } from "./E2ORelationPicker";
export type { EventAttributePickerProps } from "./EventAttributePicker";
export type { EventPickerProps } from "./EventPicker";
export type { O2ORelationPickerProps } from "./O2ORelationPicker";
export type { ObjectAttributePickerProps } from "./ObjectAttributePicker";
export type { ObjectPickerProps } from "./ObjectPicker";
export type { ObjectTypePickerProps } from "./ObjectTypePicker";
export type {
  OptionPickerProps,
  PickerGroup,
  PickerOption,
} from "./OptionPicker";
export type {
  AttributeRef,
  MultiSelection,
  OcelPickerProps,
  OcelSource,
  PickerProps,
  Relation,
  Selection,
  SingleSelection,
} from "./types";

// Everything built on r4pm reaches for `document` as it loads, so it stays
// out of the server render.
const clientOnly = <P,>(load: () => Promise<ComponentType<P>>) =>
  dynamic(load, { ssr: false });

export const OptionPicker = clientOnly(() =>
  import("./OptionPicker").then((m) => m.OptionPicker),
) as <T>(props: OptionPickerProps<T>) => JSX.Element;

export const EventTypePicker = clientOnly(() =>
  import("./ActivityPicker").then((m) => m.ActivityPicker),
);
export const ObjectTypePicker = clientOnly(() =>
  import("./ObjectTypePicker").then((m) => m.ObjectTypePicker),
);
export const EventPicker = clientOnly(() =>
  import("./EventPicker").then((m) => m.EventPicker),
);
export const ObjectPicker = clientOnly(() =>
  import("./ObjectPicker").then((m) => m.ObjectPicker),
);
export const EventAttributePicker = clientOnly(() =>
  import("./EventAttributePicker").then((m) => m.EventAttributePicker),
);
export const ObjectAttributePicker = clientOnly(() =>
  import("./ObjectAttributePicker").then((m) => m.ObjectAttributePicker),
);
export const AttributePicker = clientOnly(() =>
  import("./AttributePicker").then((m) => m.AttributePicker),
);
export const E2ORelationPicker = clientOnly(() =>
  import("./E2ORelationPicker").then((m) => m.E2ORelationPicker),
);
export const O2ORelationPicker = clientOnly(() =>
  import("./O2ORelationPicker").then((m) => m.O2ORelationPicker),
);
