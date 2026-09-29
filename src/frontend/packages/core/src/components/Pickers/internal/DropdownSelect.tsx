import {
  Box,
  Button,
  Flex,
  Popover,
  Spinner,
  Text,
  TextField,
} from "@r4pm/components/ui";
import { CheckIcon, ChevronsUpDownIcon, SearchIcon } from "lucide-react";
import {
  Fragment,
  type KeyboardEvent,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { PickedBadges, Swatch } from "./Field";
import { groupOptions, type OptionPickerProps } from "./options";
import type { PickerModel } from "./usePickerModel";

/** Rows rendered at once; beyond it, the reader narrows the search. */
const ROW_LIMIT = 200;

/**
 * A field that opens a searchable list. Built on the Radix popover r4pm
 * ships, and shows what r4pm's `Combobox` cannot: counts, groups and a
 * search the server answers.
 */
export const DropdownSelect = <T,>({
  model,
  label,
  placeholder,
  emptyText,
  disabled,
  autoFocus,
  counts = true,
  loading,
  error,
  missing,
  search,
  onSearch,
}: OptionPickerProps<T> & { model: PickerModel<T> }) => {
  const [open, setOpen] = useState(autoFocus ?? false);
  const [localQuery, setLocalQuery] = useState("");
  const [active, setActive] = useState(0);
  const listId = useId();

  // Inside a dialog - Mantine's or Radix's - the list opens inside it too.
  // Portalled to the body it would sit under a Mantine modal, and the modal's
  // scroll lock would keep the wheel from scrolling it. It goes beside the
  // dialog's content rather than into it, whose overflow and transform would
  // clip it. (Mantine's layer there ignores the mouse, hence `pointerEvents`.)
  const anchorRef = useRef<HTMLDivElement>(null);
  const [container, setContainer] = useState<HTMLElement>();
  useLayoutEffect(() => {
    const dialog = anchorRef.current?.closest<HTMLElement>('[role="dialog"]');
    setContainer(dialog?.parentElement ?? undefined);
  }, []);

  const query = onSearch ? (search ?? "") : localQuery;
  const setQuery = (next: string) => {
    if (onSearch) onSearch(next);
    else setLocalQuery(next);
    setActive(0);
  };

  const needle = localQuery.trim().toLowerCase();
  const matching =
    onSearch || !needle
      ? model.options
      : model.options.filter(
          (option) =>
            option.label.toLowerCase().includes(needle) ||
            option.group?.label.toLowerCase().includes(needle),
        );
  const rows = groupOptions(matching)
    .flatMap(({ options }) => options)
    .slice(0, ROW_LIMIT);

  useEffect(() => {
    document
      .getElementById(`${listId}-${active}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active, listId]);

  const choose = (index: number) => {
    const option = rows[index];
    if (!option) return;
    model.toggle(option.value);
    if (!model.multiple) {
      setOpen(false);
      setQuery("");
    }
  };

  const navigate = (event: KeyboardEvent) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((index) =>
        Math.min(Math.max(index + step, 0), Math.max(rows.length - 1, 0)),
      );
    } else if (event.key === "Enter") {
      event.preventDefault();
      choose(active);
    }
  };

  const [single] = model.multiple ? [] : model.picked;
  const triggerText =
    missing ??
    (single?.label ||
      (model.multiple && model.picked.length > 0
        ? "Add…"
        : (placeholder ?? (model.multiple ? "Add…" : "Choose…"))));
  const inactive = disabled || !!missing;
  const indicator =
    loading && !open ? (
      <Spinner size="1" />
    ) : (
      <ChevronsUpDownIcon size={14} aria-hidden style={{ flex: "none" }} />
    );

  const emptyRow = error
    ? "Couldn't load the choices"
    : loading
      ? "Loading…"
      : model.options.length > 0 || (onSearch && query)
        ? `Nothing matches "${query}"`
        : (emptyText ?? "Nothing to choose from");

  return (
    <Flex ref={anchorRef} direction="column" gap="1">
      <Popover.Root
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setQuery("");
        }}
      >
        {model.multiple ? (
          // The picked values live in the field, and the list opens below
          // the whole of it, so it never covers what has been picked.
          // Radix Themes' Popover.Anchor drops its children, so the whole
          // field is the trigger; a tag's remove button stops its click
          // before the field sees it.
          <Popover.Trigger>
            <Flex
              role="button"
              tabIndex={inactive ? -1 : 0}
              aria-label={label ?? placeholder}
              aria-disabled={inactive}
              align="center"
              gap="1"
              px="1"
              py="1"
              onClick={(event) => {
                // Radix leaves a click alone that was handled already.
                if (inactive) event.preventDefault();
              }}
              onKeyDown={(event) => {
                if (inactive || open) return;
                if (["Enter", " ", "ArrowDown"].includes(event.key)) {
                  event.preventDefault();
                  setOpen(true);
                }
              }}
              style={{
                minHeight: "var(--space-6)",
                borderRadius: "var(--radius-2)",
                background: "var(--gray-a2)",
                boxShadow: "inset 0 0 0 1px var(--gray-a7)",
                cursor: inactive ? "default" : "pointer",
                opacity: inactive ? 0.6 : undefined,
                outlineColor: "var(--focus-8)",
              }}
            >
              {/* Tags wrap onto more lines; the chevron stays at the right. */}
              <Flex
                align="center"
                gap="1"
                wrap="wrap"
                flexGrow="1"
                minWidth="0"
              >
                <PickedBadges
                  picked={model.picked}
                  onRemove={model.remove}
                  disabled={disabled}
                  inline
                />
                <Text
                  size="2"
                  color="gray"
                  truncate
                  style={{ flex: "1 1 60px", minWidth: 60, paddingLeft: 4 }}
                >
                  {triggerText}
                </Text>
              </Flex>
              <Flex pr="1" style={{ flex: "none", color: "var(--gray-a11)" }}>
                {indicator}
              </Flex>
            </Flex>
          </Popover.Trigger>
        ) : (
          <Popover.Trigger disabled={inactive}>
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
                {single && <Swatch color={single.color} />}
                <Text
                  truncate
                  color={single && !missing ? undefined : "gray"}
                  highContrast={!!single && !missing}
                >
                  {triggerText}
                </Text>
              </Flex>
              {indicator}
            </Button>
          </Popover.Trigger>
        )}

        <Popover.Content
          container={container}
          size="1"
          align="start"
          style={{
            width: "var(--radix-popover-trigger-width)",
            minWidth: 260,
            padding: 6,
            pointerEvents: "auto",
          }}
        >
          <TextField.Root
            autoFocus
            size="2"
            value={query}
            placeholder="Search…"
            role="combobox"
            aria-expanded
            aria-controls={listId}
            aria-activedescendant={
              rows[active] ? `${listId}-${active}` : undefined
            }
            onChange={(event) => setQuery(event.currentTarget.value)}
            onKeyDown={navigate}
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

          <Box
            id={listId}
            role="listbox"
            aria-multiselectable={model.multiple}
            aria-label={label}
            mt="1"
            style={{ maxHeight: 280, overflowY: "auto" }}
          >
            {rows.length === 0 ? (
              <Box p="2">
                <Text size="1" color={error ? "red" : "gray"}>
                  {emptyRow}
                </Text>
              </Box>
            ) : (
              rows.map((option, index) => {
                const id = model.idOf(option.value);
                const isPicked = model.pickedIds.has(id);
                const group = option.group;
                const newGroup =
                  group && rows[index - 1]?.group?.label !== group.label;
                return (
                  <Fragment key={id}>
                    {newGroup && (
                      <Flex
                        gap="2"
                        align="center"
                        px="2"
                        pt={index === 0 ? "1" : "2"}
                        pb="1"
                      >
                        <Swatch color={group.color} />
                        <Text size="1" weight="medium">
                          {group.label}
                        </Text>
                        {group.caption && (
                          <Text size="1" color="gray">
                            {group.caption}
                          </Text>
                        )}
                      </Flex>
                    )}
                    <Flex
                      id={`${listId}-${index}`}
                      role="option"
                      aria-selected={isPicked}
                      align="center"
                      gap="2"
                      px="2"
                      py="1"
                      onMouseEnter={() => setActive(index)}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => choose(index)}
                      style={{
                        cursor: "pointer",
                        borderRadius: "var(--radius-2)",
                        background:
                          index === active ? "var(--accent-a3)" : undefined,
                        paddingLeft: group ? 20 : undefined,
                      }}
                    >
                      <Swatch color={option.color} />
                      <Text size="2" truncate style={{ flex: 1 }}>
                        {option.label}
                        {option.description && (
                          <Text size="1" color="gray">
                            {"  "}
                            {option.description}
                          </Text>
                        )}
                      </Text>
                      {counts && option.count !== undefined && (
                        <Text size="1" color="gray">
                          {option.count.toLocaleString()}
                        </Text>
                      )}
                      <Box width="14px" style={{ flex: "none" }}>
                        {isPicked && <CheckIcon size={14} aria-hidden />}
                      </Box>
                    </Flex>
                  </Fragment>
                );
              })
            )}
          </Box>

          {(matching.length > ROW_LIMIT || model.picked.length > 0) && (
            <Flex justify="between" align="center" mt="1" px="1">
              <Text size="1" color="gray">
                {matching.length > ROW_LIMIT &&
                  `First ${ROW_LIMIT} of ${matching.length.toLocaleString()} – type to narrow down`}
              </Text>
              {model.picked.length > 0 && (
                <Button
                  variant="ghost"
                  color="gray"
                  size="1"
                  onClick={() => {
                    model.set([]);
                    if (!model.multiple) setOpen(false);
                  }}
                >
                  Clear
                </Button>
              )}
            </Flex>
          )}
        </Popover.Content>
      </Popover.Root>
    </Flex>
  );
};
