import "@r4pm/components/styles.css";

import { Box, LoadingOverlay, Tabs } from "@mantine/core";
import { defineModuleRoute, useCurrentOcel } from "@ocelescope/core";
import { useObjectTypes, useObjectVariants } from "@ocelescope/api-base";
import { LogVariants, Theme } from "@r4pm/components";
import type { TraceVariants } from "@r4pm/components";
import { useMemo } from "react";

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

  return (
    <Box pos="relative" mih={200}>
      <LoadingOverlay visible={isPending || !data || !variants} />
      {data && variants && (
        <LogVariants
          variants={variants}
          numEvents={data.event_count}
          numTraces={data.case_count}
        />
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
