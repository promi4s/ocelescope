import {
  ActionIcon,
  Autocomplete,
  Box,
  Button,
  Group,
  LoadingOverlay,
  Popover,
  Scroller,
  Tabs,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useObjectTypes, useObjectVariants } from "@ocelescope/api-base";
import {
  defineModuleRoute,
  useCurrentOcel,
  useDownloadVariantFlatLog,
} from "@ocelescope/core";
import type { TraceVariants } from "@r4pm/components";
import { DownloadIcon, SearchIcon } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";

const LogVariants = dynamic(
  () => import("@r4pm/components").then((m) => m.LogVariants),
  { ssr: false },
);

const ObjectTypeVariants = ({
  ocelId,
  objectType,
}: {
  ocelId: string;
  objectType: string;
}) => {
  const { data, isPending } = useObjectVariants(ocelId, {
    object_type: objectType,
  });
  const { download } = useDownloadVariantFlatLog();
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);

  const variants = useMemo<TraceVariants | null>(() => {
    if (!data) {
      return null;
    }

    const activities = Array.from(
      new Set(data.variants.flatMap((variant) => variant.activities)),
    );
    const act_to_index = Object.fromEntries(
      activities.map((activity, index) => [activity, index]),
    );

    return {
      activities,
      act_to_index,
      traces: data.variants.map((variant) => [
        variant.activities.map((activity) => act_to_index[activity] ?? 0),
        variant.case_count,
      ]),
    };
  }, [data]);

  const exportSelected = () => {
    if (!data) {
      return;
    }
    const variantIds = selectedIndices
      .map((index) => data.variants[index]?.variant_id)
      .filter((id): id is string => id !== undefined);

    if (variantIds.length === 0) {
      return;
    }

    download(ocelId, { object_type: objectType, variant_ids: variantIds });
  };

  return (
    <Box pos="relative" h="100%">
      <LoadingOverlay visible={isPending || !data || !variants} />
      {data && variants && (
        <>
          <LogVariants
            variants={variants}
            numEvents={data.event_count}
            numTraces={data.case_count}
            onSelectionChange={(selection) =>
              setSelectedIndices(selection.variantIndices)
            }
          />
          {selectedIndices.length > 0 && (
            <Button
              onClick={exportSelected}
              leftSection={<DownloadIcon size={18} />}
              radius="xl"
              size="md"
              pos="fixed"
              bottom={24}
              right={24}
              style={{
                zIndex: 200,
                boxShadow: "var(--mantine-shadow-lg)",
              }}
            >
              Export {selectedIndices.length} as XES
            </Button>
          )}
        </>
      )}
    </Box>
  );
};

const VariantsPage = () => {
  const { id } = useCurrentOcel();
  const { data: objectTypes } = useObjectTypes(id, undefined, {
    query: { enabled: !!id },
  });

  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [searchOpened, { close: closeSearch, toggle: toggleSearch }] =
    useDisclosure(false);

  useEffect(() => {
    if (objectTypes && (!activeTab || !objectTypes?.includes(activeTab))) {
      setActiveTab(objectTypes?.[0] ?? null);
    }
  }, [id, objectTypes, activeTab]);

  if (!activeTab || !objectTypes || !id) {
    return <LoadingOverlay visible />;
  }

  return (
    <>
      {objectTypes.length > 0 ? (
        <Tabs
          keepMounted={false}
          h="100%"
          style={{ display: "flex", flexDirection: "column" }}
          value={activeTab}
          onChange={setActiveTab}
        >
          <Group wrap="nowrap" gap="xs" style={{ flexShrink: 0 }}>
            <Popover
              width={300}
              position="bottom-start"
              withArrow
              shadow="md"
              opened={searchOpened}
              onChange={closeSearch}
              trapFocus
              returnFocus
            >
              <Popover.Target>
                <ActionIcon
                  size={"md"}
                  onClick={toggleSearch}
                  aria-label="Search object types"
                >
                  <SearchIcon size={16} />
                </ActionIcon>
              </Popover.Target>
              <Popover.Dropdown>
                <Autocomplete
                  data={objectTypes}
                  aria-label="Object type"
                  placeholder="Search object types"
                  selectFirstOptionOnChange
                  comboboxProps={{ withinPortal: false }}
                  onOptionSubmit={(value) => {
                    setActiveTab(value);
                    closeSearch();
                  }}
                />
              </Popover.Dropdown>
            </Popover>
            <Tabs.List flex={1} miw={0}>
              <Scroller>
                {objectTypes.map((objectType) => (
                  <Tabs.Tab key={objectType} value={objectType}>
                    {objectType}
                  </Tabs.Tab>
                ))}
              </Scroller>
            </Tabs.List>
          </Group>
          {objectTypes.map((objectType) => (
            <Tabs.Panel
              key={objectType}
              value={objectType}
              pt="md"
              flex={1}
              mih={0}
            >
              <ObjectTypeVariants ocelId={id} objectType={objectType} />
            </Tabs.Panel>
          ))}
        </Tabs>
      ) : (
        <ObjectTypeVariants ocelId={id} objectType={activeTab} />
      )}
    </>
  );
};

export default defineModuleRoute({
  component: VariantsPage,
  label: "Variants",
  name: "variants",
  requiresOcel: true,
});
