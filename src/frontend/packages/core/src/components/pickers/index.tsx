import dynamic from "next/dynamic";
import type { ActivityPickerProps } from "./ActivityPicker";
import type { EventAttributePickerProps } from "./EventAttributePicker";
import type { NamePickerProps } from "./NamePicker";
import type { ObjectAttributePickerProps } from "./ObjectAttributePicker";
import type { ObjectTypePickerProps } from "./ObjectTypePicker";
import type { Selection } from "./types";

/**
 * Picking names out of an OCEL.
 *
 * Two layers, so that either can be used on its own: `NamePicker` and
 * `IdPicker` are presentational - handed what to offer, they report what was
 * picked - and one picker per endpoint wraps them around the OCEL module's
 * counts, attributes and ids. Every presentational prop passes through, so a
 * page that wants no search, no bars or a cutoff rail says so.
 */

export type { ActivityPickerProps } from "./ActivityPicker";
export type { EventAttributePickerProps } from "./EventAttributePicker";
export type { EventPickerProps } from "./EventPicker";
export type { IdPickerProps } from "./IdPicker";
export type { NameItem, NamePickerProps } from "./NamePicker";
export type { ObjectAttributePickerProps } from "./ObjectAttributePicker";
export type { ObjectPickerProps } from "./ObjectPicker";
export type { ObjectTypePickerProps } from "./ObjectTypePicker";
export type {
  MultiPicker,
  OcelSource,
  Selection,
  SinglePicker,
} from "./types";

// Everything built on r4pm's frequency picker reaches for `document` as it
// loads, so it stays out of the server render - the same boundary the charts
// are mounted behind. The id pickers are Mantine and need none.
export const NamePicker = dynamic<NamePickerProps & Selection>(
  () => import("./NamePicker").then((module) => module.NamePicker),
  { ssr: false },
);

export const ActivityPicker = dynamic<ActivityPickerProps & Selection>(
  () => import("./ActivityPicker").then((module) => module.ActivityPicker),
  { ssr: false },
);

export const ObjectTypePicker = dynamic<ObjectTypePickerProps & Selection>(
  () => import("./ObjectTypePicker").then((module) => module.ObjectTypePicker),
  { ssr: false },
);

export const EventAttributePicker = dynamic<
  EventAttributePickerProps & Selection
>(
  () =>
    import("./EventAttributePicker").then(
      (module) => module.EventAttributePicker,
    ),
  { ssr: false },
);

export const ObjectAttributePicker = dynamic<
  ObjectAttributePickerProps & Selection
>(
  () =>
    import("./ObjectAttributePicker").then(
      (module) => module.ObjectAttributePicker,
    ),
  { ssr: false },
);

export { EventPicker } from "./EventPicker";
export { IdPicker } from "./IdPicker";
export { ObjectPicker } from "./ObjectPicker";
