import { Badge, Button, Group, Modal, Stack, TextInput } from "@mantine/core";
import { generateColor } from "@marko19907/string-to-color";
import { useState } from "react";
import type { PluginOutput, ResultSelection } from "../../api/plugin";

export const SaveOutputsModal = ({
  opened,
  onClose,
  outputs,
  onSave,
}: {
  opened: boolean;
  onClose: () => void;
  onSave: (selections: ResultSelection[]) => void;
  outputs: PluginOutput[];
}) => {
  const [names, setNames] = useState<Record<string, string>>({});

  return (
    <Modal opened={opened} onClose={onClose} title={"Save to Session"}>
      <Stack>
        <Stack gap={"xs"}>
          {outputs.map(({ id, name, type_label }) => (
            <Group key={id}>
              <TextInput
                placeholder={name}
                value={names[id] ?? ""}
                flex={1}
                onChange={(event) =>
                  setNames({
                    ...names,
                    [id]: event.currentTarget.value,
                  })
                }
              />
              <Badge size="sm" color={generateColor(type_label)}>
                {type_label}
              </Badge>
            </Group>
          ))}
        </Stack>
        <Button
          onClick={() => {
            onSave(
              outputs.map(({ id }) => ({
                id,
                name: names[id] || null,
              })),
            );
            onClose();
          }}
        >
          Save to Session
        </Button>
      </Stack>
    </Modal>
  );
};
