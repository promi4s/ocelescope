import { DropdownSelect } from "./internal/DropdownSelect";
import { Field } from "./internal/Field";
import { ListSelect } from "./internal/ListSelect";
import type { OptionPickerProps } from "./internal/options";
import { usePickerModel } from "./internal/usePickerModel";

export type {
  OptionPickerProps,
  PickerGroup,
  PickerOption,
} from "./internal/options";

/**
 * Picking values out of a list of options, as a dropdown or as a list.
 *
 * Presentational: handed the options, it reports what was picked. Every OCEL
 * picker is this, wrapped around an endpoint; use it directly for choices
 * that come from elsewhere.
 */
export const OptionPicker = <T,>(props: OptionPickerProps<T>) => {
  const model = usePickerModel(props);
  return (
    <Field label={props.label} description={props.description}>
      {props.variant === "list" ? (
        <ListSelect {...props} model={model} />
      ) : (
        <DropdownSelect {...props} model={model} />
      )}
    </Field>
  );
};
