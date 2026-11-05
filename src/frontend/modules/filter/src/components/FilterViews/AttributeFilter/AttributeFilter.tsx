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
import { useState } from "react";
import type {
  EventAttributeFilter,
  ObjectAttributeFilter,
} from "../../../api/base";
import AttributeTable from "./AttributeTable";
import ConditionView from "./ConditionView";
import {
  type AttributeFilter,
  conditionSummary,
  initialCondition,
  withCondition,
  withoutCondition,
} from "./util";

const MODE_OPTIONS = [
  { label: "Include", value: "include" },
  { label: "Exclude", value: "exclude" },
];

const TARGET_OPTIONS = [
  { label: "With attribute", value: "carrying" },
  { label: "All", value: "all" },
  { label: "Selected", value: "selected" },
];

type TargetKind = "carrying" | "all" | "selected";

const targetKind = (target: AttributeFilter["target"]): TargetKind =>
  Array.isArray(target) ? "selected" : (target ?? "carrying");

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
  const targetInfo = `Which ${typeNoun} the filter applies to; all others are kept untouched. With attribute: only ${typeNoun} where every chosen attribute has a value at least once. All: every one of them, and a missing attribute counts as empty. Selected: only the ${typeNoun} you pick.`;

  return ({ ocelId, viewId, step: filter, onChange }) => {
    const [opened, setOpened] = useState<string | null>(null);
    const condition = opened ? filter.conditions[opened] : undefined;

    if (opened && condition) {
      return (
        <ConditionView
          ocelId={ocelId}
          viewId={viewId}
          entityType={entityType}
          attribute={opened}
          types={Array.isArray(filter.target) ? filter.target : undefined}
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
          <Input.Wrapper label={<InfoLabel label="Target" info={targetInfo} />}>
            <Box>
              <SegmentedControl
                size="xs"
                data={TARGET_OPTIONS}
                value={targetKind(filter.target)}
                onChange={(next) =>
                  onChange({
                    ...filter,
                    target:
                      next === "selected"
                        ? []
                        : (next as Exclude<TargetKind, "selected">),
                  })
                }
              />
            </Box>
          </Input.Wrapper>
          {Array.isArray(filter.target) && (
            <Box flex={1} miw={0}>
              <TypePicker
                multiple
                ocelId={ocelId}
                {...viewProps(viewId)}
                label={entityType === "events" ? "Activities" : "Object types"}
                placeholder={`Choose ${typeNoun}…`}
                value={filter.target}
                onChange={(target) => onChange({ ...filter, target })}
              />
            </Box>
          )}
        </Group>
        <AttributeTable
          key={Array.isArray(filter.target) ? filter.target.join("\u0000") : ""}
          ocelId={ocelId}
          viewId={viewId}
          entityType={entityType}
          types={Array.isArray(filter.target) ? filter.target : undefined}
          added={Object.keys(filter.conditions)}
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

const targetSummary = (target: AttributeFilter["target"]) => {
  if (Array.isArray(target)) {
    return ` (${target.join(", ")})`;
  }
  return target === "all" ? " (all)" : "";
};

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
