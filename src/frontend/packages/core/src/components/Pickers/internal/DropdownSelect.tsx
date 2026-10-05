import { Button, Flex, Popover, Spinner, Text } from "@r4pm/components/ui";
import { ChevronsUpDownIcon } from "lucide-react";
import { useState } from "react";
import { Swatch } from "./Field";
import { ListSelect } from "./ListSelect";
import type { OptionPickerProps } from "./options";
import type { PickerModel } from "./usePickerModel";

/**
 * A field that names what is picked and opens the list in a popover, so both
 * variants are the same list.
 */
export const DropdownSelect = <T,>(
  props: OptionPickerProps<T> & { model: PickerModel<T> },
) => {
  const { model, label, placeholder, disabled, missing, loading } = props;
  const [open, setOpen] = useState(props.autoFocus ?? false);

  const picked = model.picked.map(({ label }) => label).join(", ");
  const [first] = model.picked;

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger disabled={disabled || !!missing}>
        <Button
          variant="surface"
          color="gray"
          aria-label={label ?? placeholder}
          style={{
            width: "100%",
            justifyContent: "space-between",
            fontWeight: "normal",
          }}
        >
          <Flex gap="2" align="center" minWidth="0">
            {model.picked.length === 1 && <Swatch color={first?.color} />}
            <Text truncate highContrast={!!picked && !missing}>
              {missing ?? (picked || placeholder || "Choose…")}
            </Text>
          </Flex>
          {loading ? (
            <Spinner size="1" />
          ) : (
            <ChevronsUpDownIcon
              size={14}
              aria-hidden
              style={{ flex: "none" }}
            />
          )}
        </Button>
      </Popover.Trigger>
      <Popover.Content
        size="1"
        align="start"
        style={{
          width: "var(--radix-popover-trigger-width)",
          minWidth: 260,
          maxHeight: "var(--radix-popover-content-available-height)",
          // Above a Mantine modal, which the popover is portalled outside of.
          zIndex: 400,
        }}
      >
        <ListSelect
          {...props}
          autoFocus
          model={
            model.multiple
              ? model
              : {
                  ...model,
                  set: (values) => {
                    model.set(values);
                    setOpen(false);
                  },
                }
          }
        />
      </Popover.Content>
    </Popover.Root>
  );
};
