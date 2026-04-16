import {
  Badge,
  Box,
  Button,
  Group,
  Loader,
  ScrollArea,
  Stack,
  Text,
  TextInput,
  UnstyledButton,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { useEventIds, useObjectIds } from "@ocelescope/api-base";
import { useEffect, useMemo, useState } from "react";

type Props = {
  ocelId: string;
  entityType: "event" | "object";
  value: string | string[];
  onChange: (value: string | string[]) => void;
  isMulti?: boolean;
  label?: string;
  placeholder?: string;
  pageSize?: number;
};

const arraysEqual = (a: string[], b: string[]) =>
  a.length === b.length && a.every((value, index) => value === b[index]);

const OcelIdSelect: React.FC<Props> = ({
  ocelId,
  entityType,
  value,
  onChange,
  isMulti = false,
  label,
  placeholder,
  pageSize = 25,
}) => {
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search, 300);

  const [page, setPage] = useState(1);
  const [options, setOptions] = useState<string[]>([]);

  const queryArgs = {
    search: debouncedSearch || undefined,
    page,
    size: pageSize,
  };

  const eventQuery = useEventIds(
    ocelId,
    entityType === "event" ? queryArgs : undefined,
  );
  const objectQuery = useObjectIds(
    ocelId,
    entityType === "object" ? queryArgs : undefined,
  );

  const query = entityType === "event" ? eventQuery : objectQuery;

  const currentPageItems = query.data?.response ?? [];
  const currentPage = query.data?.page ?? page;
  const totalPages = query.data?.total_pages ?? 1;

  const selectedValues = useMemo<string[]>(
    () => (Array.isArray(value) ? value : value ? [value] : []),
    [value],
  );

  useEffect(() => {
    setPage((prev) => (prev === 1 ? prev : 1));
    setOptions((prev) => (prev.length === 0 ? prev : []));
  }, [debouncedSearch, entityType, ocelId]);

  useEffect(() => {
    if (!query.data) return;

    const incoming = query.data.response ?? [];
    const incomingPage = query.data.page ?? 1;

    setOptions((prev) => {
      if (incomingPage <= 1) {
        return arraysEqual(prev, incoming) ? prev : incoming;
      }

      const merged = [...prev];
      for (const item of incoming) {
        if (!merged.includes(item)) {
          merged.push(item);
        }
      }

      return arraysEqual(prev, merged) ? prev : merged;
    });
  }, [query.data]);

  const hasMore = currentPage < totalPages;

  const toggleSingle = (id: string) => {
    onChange(id);
  };

  const toggleMulti = (id: string) => {
    const next = selectedValues.includes(id)
      ? selectedValues.filter((value) => value !== id)
      : [...selectedValues, id];
    onChange(next);
  };

  const removeSelected = (id: string) => {
    if (isMulti) {
      onChange(selectedValues.filter((value) => value !== id));
    } else if (selectedValues[0] === id) {
      onChange("");
    }
  };

  return (
    <Stack gap="xs">
      <TextInput
        label={label}
        placeholder={placeholder ?? "Type to search ids"}
        value={search}
        onChange={(event) => setSearch(event.currentTarget.value)}
      />

      {selectedValues.length > 0 && (
        <Group gap="xs">
          {selectedValues.map((id) => (
            <Badge
              key={id}
              variant="filled"
              style={{ cursor: "pointer" }}
              onClick={() => removeSelected(id)}
            >
              {id}
            </Badge>
          ))}
        </Group>
      )}

      <Box
        style={{
          border: "1px solid var(--mantine-color-gray-3)",
          borderRadius: 8,
          overflow: "hidden",
        }}
      >
        <ScrollArea h={220}>
          <Stack gap={0}>
            {options.length === 0 && !query.isLoading && !query.isFetching && (
              <Text c="dimmed" size="sm" p="sm">
                {search ? "No matching element" : "Type above to search ids"}
              </Text>
            )}

            {options.map((id) => {
              const isSelected = selectedValues.includes(id);

              return (
                <UnstyledButton
                  key={id}
                  onClick={() => (isMulti ? toggleMulti(id) : toggleSingle(id))}
                  style={{
                    padding: "8px 12px",
                    background: isSelected
                      ? "var(--mantine-color-blue-light)"
                      : "transparent",
                    borderBottom: "1px solid var(--mantine-color-gray-2)",
                    textAlign: "left",
                  }}
                >
                  <Text size="sm">{id}</Text>
                </UnstyledButton>
              );
            })}

            {(query.isLoading || query.isFetching) && (
              <Group justify="center" p="sm">
                <Loader size="sm" />
              </Group>
            )}

            {!query.isLoading && !query.isFetching && hasMore && (
              <Group justify="center" p="sm">
                <Button
                  variant="subtle"
                  size="xs"
                  onClick={() => setPage((prev) => prev + 1)}
                >
                  Load more
                </Button>
              </Group>
            )}

            {!hasMore && options.length > 0 && (
              <Text c="dimmed" size="xs" p="sm">
                End of results
              </Text>
            )}
          </Stack>
        </ScrollArea>
      </Box>
    </Stack>
  );
};

export default OcelIdSelect;
