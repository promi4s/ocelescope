import {
  Box,
  Group,
  Input,
  SegmentedControl,
  Stack,
  Text,
  Tooltip,
} from "@mantine/core";
import {
  ActivityPicker,
  ObjectTypePicker,
  type StepKind,
  type StepPanel,
  viewProps,
} from "@ocelescope/core";
import { InfoIcon } from "lucide-react";
import { useMemo, useState } from "react";
import type {
  EventAttributeFilter,
  ObjectAttributeFilter,
} from "../../../api/base";
import AttributeTable from "./AttributeTable";
import ConditionView from "./ConditionView";
import {
  type AttributeFilter,
  conditionSummary,
  conditionText,
  initialCondition,
  withCondition,
  withoutCondition,
} from "./util";

const MODE_OPTIONS = [
  { label: "Include", value: "include" },
  { label: "Exclude", value: "exclude" },
];

const InfoLabel: React.FC<{ label: string; info: string }> = ({
  label,
  info,
}) => (
  <Group gap={4} wrap="nowrap" component="span">
    <Text component="span" size="sm" fw={500}>
      {label}
    </Text>
    <Tooltip label={info} multiline w={280} withArrow>
      <InfoIcon
        size={14}
        color="var(--mantine-color-dimmed)"
        aria-label={`About ${label}`}
      />
    </Tooltip>
  </Group>
);

const AttributePanel: (
  entityType: "objects" | "events",
) => StepPanel<AttributeFilter> = (entityType) => {
  const TypePicker =
    entityType === "events" ? ActivityPicker : ObjectTypePicker;
  const typeNoun = entityType === "events" ? "activities" : "object types";
  const modeInfo = `Include keeps the ${entityType} that match every attribute condition. Exclude removes them and keeps the rest.`;
  const targetInfo = `Which ${typeNoun} the filter applies to; all others are kept untouched. Leave it empty to apply it to all ${typeNoun}; a missing attribute then counts as missing.`;

  return ({ ocelId, viewId, step: filter, onChange }) => {
    const [opened, setOpened] = useState<string | null>(null);
    const condition = opened ? filter.conditions[opened] : undefined;
    const texts = useMemo(
      () =>
        Object.fromEntries(
          Object.entries(filter.conditions).map(([attribute, condition]) => [
            attribute,
            conditionText(condition),
          ]),
        ),
      [filter.conditions],
    );

    if (opened && condition) {
      return (
        <ConditionView
          ocelId={ocelId}
          viewId={viewId}
          entityType={entityType}
          attribute={opened}
          entityNames={filter.target ?? undefined}
          condition={condition}
          onChange={(next) => onChange(withCondition(filter, opened, next))}
          onRemove={() => {
            onChange(withoutCondition(filter, opened));
            setOpened(null);
          }}
          onBack={() => setOpened(null)}
        />
      );
    }

    return (
      <Stack gap="sm" flex={1} mih={0}>
        <Group gap="sm" wrap="nowrap" align="flex-end">
          <Input.Wrapper label={<InfoLabel label="Mode" info={modeInfo} />}>
            <Box>
              <SegmentedControl
                size="xs"
                data={MODE_OPTIONS}
                value={filter.mode ?? "include"}
                onChange={(mode) =>
                  onChange({ ...filter, mode: mode as AttributeFilter["mode"] })
                }
              />
            </Box>
          </Input.Wrapper>
          <Input.Wrapper
            flex={1}
            miw={0}
            label={
              <InfoLabel
                label={entityType === "events" ? "Activities" : "Object types"}
                info={targetInfo}
              />
            }
          >
            <TypePicker
              multiple
              ocelId={ocelId}
              {...viewProps(viewId)}
              placeholder={`All ${typeNoun}`}
              value={filter.target ?? []}
              onChange={(target) =>
                onChange({
                  ...filter,
                  target: target.length > 0 ? target : undefined,
                })
              }
            />
          </Input.Wrapper>
        </Group>
        <AttributeTable
          key={filter.target?.join("\u0000") ?? ""}
          ocelId={ocelId}
          viewId={viewId}
          entityType={entityType}
          types={filter.target ?? undefined}
          conditions={texts}
          onAdd={(attribute) => {
            onChange(
              withCondition(
                filter,
                attribute.name,
                initialCondition(attribute),
              ),
            );
            setOpened(attribute.name);
          }}
          onEdit={setOpened}
          onRemove={(attribute) =>
            onChange(withoutCondition(filter, attribute))
          }
        />
      </Stack>
    );
  };
};

const targetSummary = (target: AttributeFilter["target"]) =>
  target?.length ? ` (${target.join(", ")})` : "";

const summary = (filter: AttributeFilter) => {
  const conditions = Object.entries(filter.conditions);
  if (conditions.length === 0) {
    return "No attribute selected";
  }
  const exclusion = filter.mode === "exclude" ? "Exclude " : "";
  const parts = conditions
    .map(([attribute, condition]) => conditionSummary(attribute, condition))
    .join(" and ");
  return `${exclusion}${parts}${targetSummary(filter.target)}`;
};

const validate = (filter: AttributeFilter) =>
  Object.keys(filter.conditions).length > 0
    ? {}
    : { conditions: "Pick an attribute" };

export const eventAttributeKind: StepKind<EventAttributeFilter> = {
  title: "Event Attribute",
  description:
    "Keeps the events whose value of one attribute satisfies a condition, such as a value range or a pattern. Pick the attribute with Use, then set the condition on its value distribution: a range for numbers and dates, chosen values or a pattern otherwise. With Exclude, the matching events are removed instead. Activities without the attribute are left untouched.",
  Panel: AttributePanel("events") as StepPanel<EventAttributeFilter>,
  create: () => ({ type: "event_attribute", conditions: {} }),
  summary,
  validate,
};

export const objectAttributeKind: StepKind<ObjectAttributeFilter> = {
  title: "Object Attribute",
  description:
    "Keeps the objects whose value of one attribute satisfies a condition, such as a value range or a pattern. Pick the attribute with Use, then set the condition on its value distribution: a range for numbers and dates, chosen values or a pattern otherwise. With Exclude, the matching objects are removed instead. Object types without the attribute are left untouched.",
  Panel: AttributePanel("objects") as StepPanel<ObjectAttributeFilter>,
  create: () => ({ type: "object_attribute", conditions: {} }),
  summary,
  validate,
};
