import {
  ActionIcon,
  Group,
  MultiSelect,
  type MultiSelectProps,
  Select,
  type SelectProps,
} from "@mantine/core";
import type { ReactNode } from "react";

type Controlled<P extends SelectProps | MultiSelectProps> = Omit<
  P,
  "defaultValue"
> &
  Required<Pick<P, "value" | "onChange">>;

export type ActionSelectProps = { actions?: ReactNode } & (
  | (Controlled<SelectProps> & { multiple?: false })
  | (Controlled<MultiSelectProps> & { multiple: true })
);

const attachedStyles = {
  input: { borderTopRightRadius: 0, borderBottomRightRadius: 0 },
};

const renderSelect = (props: ActionSelectProps) => {
  const styles = props.actions ? attachedStyles : undefined;

  if (props.multiple) {
    const { multiple: _, actions: __, ...rest } = props;
    return <MultiSelect flex={1} miw={0} styles={styles} {...rest} />;
  }

  const { multiple: _, actions: __, ...rest } = props;
  return <Select flex={1} miw={0} styles={styles} {...rest} />;
};

export const ActionSelect: React.FC<ActionSelectProps> = (props) => (
  <Group wrap="nowrap" gap={0} align="flex-end">
    {renderSelect(props)}
    {props.actions && (
      <ActionIcon.Group>
        <ActionIcon.GroupSection hidden />
        {props.actions}
      </ActionIcon.Group>
    )}
  </Group>
);
