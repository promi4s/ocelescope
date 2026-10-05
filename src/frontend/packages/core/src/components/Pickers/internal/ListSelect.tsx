import {
  EmptyState,
  ErrorState,
  FrequencyPicker,
  SkeletonList,
  softBadgeStyle,
} from "@r4pm/components";
import { Badge, Flex, Spinner, Text, TextField } from "@r4pm/components/ui";
import { SearchIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import { PickedBadges } from "./Field";
import classes from "./ListSelect.module.css";
import { groupOptions, type OptionPickerProps } from "./options";
import type { PickerModel } from "./usePickerModel";

/** Lists at most this long get no search box of their own. */
const SEARCH_FROM = 8;

/** One r4pm list scrolls after eight rows; several groups of them share
 * this height, so a grouped picker stays as compact. */
const GROUPS_HEIGHT = 320;

/**
 * Every choice at once, one r4pm `FrequencyPicker` per group, so choices
 * keep the colour and frequency bars they have in the viewers.
 */
export const ListSelect = <T,>({
  model,
  counts = true,
  bars = true,
  cutoff = false,
  sort = "count",
  emptyText,
  disabled,
  autoFocus,
  loading,
  error,
  missing,
  search,
  onSearch,
  total,
}: OptionPickerProps<T> & { model: PickerModel<T> }) => {
  const groups = groupOptions(model.options);

  // Each r4pm list scrolls its first row into view when React's dev mode
  // runs its effects twice, which leaves the groups scrolled to the last one.
  const groupsRef = useRef<HTMLDivElement>(null);
  const groupCount = groups.length;
  useEffect(() => {
    if (groupCount < 2) return;
    const frame = requestAnimationFrame(() =>
      groupsRef.current?.scrollTo({ top: 0 }),
    );
    return () => cancelAnimationFrame(frame);
  }, [groupCount]);
  // With a server-side search, a picked value can drop out of the options.
  const shownIds = new Set(model.options.map((o) => model.idOf(o.value)));
  const offList = model.picked.filter(({ id }) => !shownIds.has(id));

  const content = () => {
    if (missing) return <EmptyState title={missing} />;
    if (error) return <ErrorState error={error} title="Couldn't load" />;
    if (loading && model.options.length === 0) return <SkeletonList rows={4} />;
    if (model.options.length === 0)
      return <EmptyState title={emptyText ?? "Nothing to choose from"} />;

    const lists = groups.map(({ group, options }) => {
      const byLabel = new Map(options.map((option) => [option.label, option]));
      const groupIds = new Set(options.map((o) => model.idOf(o.value)));
      const pickedLabels = options
        .filter((option) => model.pickedIds.has(model.idOf(option.value)))
        .map((option) => option.label);

      return (
        <Flex key={group?.label ?? ""} direction="column" gap="1">
          {group && (
            <Flex gap="2" align="center">
              <Badge
                size="1"
                style={group.color ? softBadgeStyle(group.color) : undefined}
              >
                {group.label}
              </Badge>
              {group.caption && (
                <Text size="1" color="gray">
                  {group.caption}
                </Text>
              )}
            </Flex>
          )}
          <FrequencyPicker
            items={options.map((option) => ({
              key: option.label,
              count: option.count ?? 0,
            }))}
            value={new Set(pickedLabels)}
            onChange={(next) => {
              if (disabled) return;
              const values = [...next].flatMap((label) => {
                const option = byLabel.get(label);
                return option ? [option.value] : [];
              });
              if (!model.multiple) {
                // The newly clicked one, should the list report both.
                const fresh = values.find(
                  (value) => !model.pickedIds.has(model.idOf(value)),
                );
                return model.set(fresh !== undefined ? [fresh] : values);
              }
              model.set([
                ...model.picked
                  .filter(({ id }) => !groupIds.has(id))
                  .map(({ value }) => value),
                ...values,
              ]);
            }}
            mode={model.multiple ? "multi" : "single"}
            searchable={!onSearch && options.length > SEARCH_FROM}
            showBars={bars}
            showCounts={counts}
            showCutoff={cutoff}
            sort={sort}
            colorOf={(_, key) => byLabel.get(key)?.color}
            autoFocus={autoFocus}
            emptyText="Nothing matches"
          />
        </Flex>
      );
    });
    return groups.length > 1 ? (
      <Flex
        direction="column"
        gap="3"
        ref={groupsRef}
        style={{
          maxHeight: GROUPS_HEIGHT,
          overflowY: "auto",
          overflowX: "hidden",
        }}
      >
        {lists}
      </Flex>
    ) : (
      lists
    );
  };

  return (
    <Flex
      direction="column"
      gap="2"
      // r4pm's count line is noise when picking one value, and wrong when
      // the rows are only a page of a search.
      className={[
        !model.multiple || total !== undefined ? classes.hideCount : "",
        model.multiple ? "" : classes.single,
      ].join(" ")}
    >
      {onSearch && (
        <TextField.Root
          size="2"
          value={search ?? ""}
          placeholder="Search…"
          autoFocus={autoFocus}
          disabled={disabled || !!missing}
          onChange={(event) => onSearch(event.currentTarget.value)}
        >
          <TextField.Slot>
            <SearchIcon size={14} aria-hidden />
          </TextField.Slot>
          {loading && (
            <TextField.Slot side="right">
              <Spinner size="1" />
            </TextField.Slot>
          )}
        </TextField.Root>
      )}
      {model.multiple && total !== undefined && (
        <Text size="1" color="gray">
          {model.picked.length} of {total.toLocaleString()} selected
        </Text>
      )}
      <PickedBadges
        picked={offList}
        onRemove={model.remove}
        disabled={disabled}
      />
      {content()}
    </Flex>
  );
};
