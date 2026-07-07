import "@r4pm/components/styles.css";

import { Box, Button, LoadingOverlay, Tabs } from "@mantine/core";
import { useObjectTypes, useObjectVariants } from "@ocelescope/api-base";
import {
  defineModuleRoute,
  useCurrentOcel,
  useDownloadVariantFlatLog,
} from "@ocelescope/core";
import type { TraceVariants } from "@r4pm/components";
import { LogVariants, Theme } from "@r4pm/components";
import { DownloadIcon } from "lucide-react";
import { useMemo, useState } from "react";

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
    <Box pos="relative" mih={200}>
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

  if (!id || !objectTypes) {
    return <LoadingOverlay visible />;
  }

  const [firstObjectType, ...otherObjectTypes] = objectTypes;
  if (!firstObjectType) {
    return null;
  }

  return (
    <Theme>
      {otherObjectTypes.length > 0 ? (
        <Tabs defaultValue={firstObjectType} keepMounted={false}>
          <Tabs.List>
            {objectTypes.map((objectType) => (
              <Tabs.Tab key={objectType} value={objectType}>
                {objectType}
              </Tabs.Tab>
            ))}
          </Tabs.List>
          {objectTypes.map((objectType) => (
            <Tabs.Panel key={objectType} value={objectType} pt="md">
              <ObjectTypeVariants ocelId={id} objectType={objectType} />
            </Tabs.Panel>
          ))}
        </Tabs>
      ) : (
        <ObjectTypeVariants ocelId={id} objectType={firstObjectType} />
      )}
    </Theme>
  );
};

export default defineModuleRoute({
  component: VariantsPage,
  label: "Variants",
  name: "variants",
  requiresOcel: true,
});
