import { Card, LoadingOverlay, Pagination, Stack, Title } from "@mantine/core";
import {
  type CaseCentricVariant,
  useObjectVariants,
} from "@ocelescope/api-base";
import { Variant } from "@ocelescope/variants";
import { useMemo, useState } from "react";
import classes from "./ObjectVariantList.module.css";

const VariantCard: React.FC<{
  variant: CaseCentricVariant;
  totalExecutionNumber: number;
}> = ({ variant, totalExecutionNumber }) => {
  const percentageFrequency = Math.floor(
    (variant.frequency / totalExecutionNumber) * 10000,
  );

  return (
    <Card shadow="sm" radius="md" withBorder>
      <Stack gap={"xs"}>
        <Title order={4}>
          {`${variant.id.replace(`${variant.object_type}_`, "").slice(0, 10)} (${variant.frequency}, ${percentageFrequency > 0 ? percentageFrequency / 100 : "<0.01"}%)`}
        </Title>
        <Variant variant={variant.activity_order} enableGrouping />
      </Stack>
    </Card>
  );
};

const PAGE_SIZE = 10;

export const ObjectVariantList: React.FC<{
  ocelId: string;
  objectType: string;
}> = ({ ocelId, objectType }) => {
  const { data } = useObjectVariants(ocelId, objectType);

  const totalExecutionNumber = useMemo(
    () => (data ?? []).reduce((acc, curr) => acc + curr.frequency, 0),
    [data],
  );

  const [currentPage, setCurrentPage] = useState(1);

  if (!data) {
    return <LoadingOverlay visible />;
  }

  return (
    <div className={classes.wrapper}>
      <div className={classes.variantList}>
        {data
          .slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
          .map((variant) => (
            <VariantCard
              key={variant.id}
              variant={variant}
              totalExecutionNumber={totalExecutionNumber}
            />
          ))}
      </div>
      {data.length > PAGE_SIZE && (
        <div className={classes.pagination}>
          <Pagination
            total={Math.ceil(data.length / PAGE_SIZE)}
            onChange={(newPage) => setCurrentPage(newPage)}
          />
        </div>
      )}
    </div>
  );
};
