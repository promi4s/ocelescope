import { Badge, LoadingOverlay, Stack, Table } from "@mantine/core";
import {
  useEventCounts,
  useGetOcel,
  useObjectCounts,
  useQuantityInfo,
  useTimeInfo,
} from "@ocelescope/api-base";
import { useMemo } from "react";
import { formatTime } from "../util/dayjs";

const OCELInfo: React.FC<{ ocelId: string }> = ({ ocelId }) => {
  const { data: ocel } = useGetOcel(ocelId);
  const { data: eventCounts } = useEventCounts(ocelId);
  const { data: objectCount } = useObjectCounts(ocelId);
  const { data: timeInfo } = useTimeInfo(ocelId);
  const { data: quantityInfo } = useQuantityInfo(ocelId);

  const totalEventCount = useMemo(
    () => Object.values(eventCounts ?? {}).reduce((acc, curr) => acc + curr, 0),
    [eventCounts],
  );

  const totalObjectCount = useMemo(
    () => Object.values(objectCount ?? {}).reduce((acc, curr) => acc + curr, 0),
    [eventCounts],
  );

  if (!ocel) {
    return <LoadingOverlay />;
  }

  return (
    <Table variant="vertical" layout="fixed" withTableBorder>
      <Table.Tbody>
        <Table.Tr>
          <Table.Th w={160}>Name:</Table.Th>
          <Table.Td>{ocel.name}</Table.Td>
        </Table.Tr>
        <Table.Tr>
          <Table.Th>Events:</Table.Th>
          <Table.Td>{`${totalEventCount.toLocaleString("en-US")} of ${Object.keys(eventCounts ?? {}).length} activities`}</Table.Td>
        </Table.Tr>
        <Table.Tr>
          <Table.Th>Objects:</Table.Th>
          <Table.Td>{`${totalObjectCount.toLocaleString("en-US")} of ${Object.keys(objectCount ?? {}).length} object types`}</Table.Td>
        </Table.Tr>
        <Table.Tr>
          <Table.Th>Timeframe:</Table.Th>
          <Table.Td>
            {`${formatTime(timeInfo?.start_time)} - ${formatTime(timeInfo?.end_time)}`}
          </Table.Td>
        </Table.Tr>
        {ocel.extensions.length > 0 && (
          <Table.Tr>
            <Table.Th>Extensions:</Table.Th>
            <Table.Td>
              {ocel.extensions.map(({ label }) => (
                <Badge>{label}</Badge>
              ))}
            </Table.Td>
          </Table.Tr>
        )}
        {quantityInfo && quantityInfo.item_types.length > 0 && (
          <Table.Tr>
            <Table.Th>Quantities:</Table.Th>
            <Table.Td>
              <Stack gap={0}>
                <span>{`${quantityInfo.item_types.length} Item types`}</span>
                <span>{`${quantityInfo.total_event_count} active events of ${quantityInfo.activities.length} activities`}</span>
                <span>{`${quantityInfo.total_object_count} active objects of ${quantityInfo.object_types.length} object types`}</span>
              </Stack>
            </Table.Td>
          </Table.Tr>
        )}
      </Table.Tbody>
    </Table>
  );
};

export default OCELInfo;
