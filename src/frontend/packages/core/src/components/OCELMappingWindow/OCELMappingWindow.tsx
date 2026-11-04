import {
  Button,
  Checkbox,
  Modal,
  MultiSelect,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { useAttributeNames, useCreateOcelMapping } from "@ocelescope/api-base";
import { useState } from "react";

type MappingTable = "events" | "objects" | "e2o" | "o2o";

const TABLE_LABELS: Record<MappingTable, string> = {
  events: "Events",
  objects: "Objects",
  e2o: "Event-to-object relations",
  o2o: "Object-to-object relations",
};

const AttributeSelect: React.FC<{
  ocelId: string;
  viewId?: string;
  entityType: "events" | "objects";
  disabled: boolean;
  value: string[];
  onChange: (value: string[]) => void;
}> = ({ ocelId, viewId, entityType, disabled, value, onChange }) => {
  const { data: attributeNames = [] } = useAttributeNames(ocelId, {
    entity_type: entityType,
    view_id: viewId,
  });

  return (
    <MultiSelect
      ml="xl"
      placeholder={
        attributeNames.length > 0 ? "Extra columns" : "No attributes available"
      }
      data={attributeNames}
      value={value}
      onChange={onChange}
      disabled={disabled || attributeNames.length === 0}
      searchable
      clearable
    />
  );
};

export const OCELMappingWindow: React.FC<{
  ocel?: { id: string; name: string };
  viewId?: string;
  onClose: () => void;
}> = ({ ocel, viewId, onClose }) => {
  const [name, setName] = useState(ocel ? `${ocel.name} mapping` : "");
  const [tables, setTables] = useState<Record<MappingTable, boolean>>({
    events: true,
    objects: true,
    e2o: false,
    o2o: false,
  });
  const [eventAttributes, setEventAttributes] = useState<string[]>([]);
  const [objectAttributes, setObjectAttributes] = useState<string[]>([]);

  const { mutate: createMapping, isPending } = useCreateOcelMapping({
    mutation: { onSuccess: onClose },
  });

  const toggle = (table: MappingTable) => (checked: boolean) =>
    setTables((current) => ({ ...current, [table]: checked }));

  const tableCheckbox = (table: MappingTable) => (
    <Checkbox
      label={TABLE_LABELS[table]}
      checked={tables[table]}
      onChange={(event) => toggle(table)(event.currentTarget.checked)}
    />
  );

  const hasTable = Object.values(tables).some(Boolean);

  return (
    <Modal
      opened={!!ocel}
      centered
      onClose={onClose}
      title="Create OCEL mapping"
    >
      {ocel && (
        <Stack>
          <TextInput
            required
            label="Name"
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
          />
          <Text size="sm" fw={500}>
            Tables
          </Text>
          <Stack gap="xs">
            {tableCheckbox("events")}
            <AttributeSelect
              ocelId={ocel.id}
              viewId={viewId}
              entityType="events"
              disabled={!tables.events}
              value={eventAttributes}
              onChange={setEventAttributes}
            />
            {tableCheckbox("objects")}
            <AttributeSelect
              ocelId={ocel.id}
              viewId={viewId}
              entityType="objects"
              disabled={!tables.objects}
              value={objectAttributes}
              onChange={setObjectAttributes}
            />
            {tableCheckbox("e2o")}
            {tableCheckbox("o2o")}
          </Stack>
          <Button
            disabled={!hasTable || !name.trim()}
            loading={isPending}
            onClick={() =>
              createMapping({
                ocelId: ocel.id,
                params: viewId ? { view_id: viewId } : undefined,
                data: {
                  name: name.trim(),
                  events: tables.events
                    ? { attributes: eventAttributes }
                    : null,
                  objects: tables.objects
                    ? { attributes: objectAttributes }
                    : null,
                  e2o: tables.e2o,
                  o2o: tables.o2o,
                },
              })
            }
          >
            Create
          </Button>
        </Stack>
      )}
    </Modal>
  );
};
