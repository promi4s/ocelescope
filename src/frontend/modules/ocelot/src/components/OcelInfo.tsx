import { Badge, LoadingOverlay, Stack, Table, Title } from "@mantine/core";
import {
  useEventCounts,
  useGetOcel,
  useObjectCounts,
  useTimeInfo,
} from "@ocelescope/api-base";
import dayjs from "dayjs";
import { useMemo } from "react";

const OCELInfo: React.FC<{ ocelId: string }> = ({ ocelId }) => {
  const { data: ocel } = useGetOcel(ocelId);
  const { data: eventCounts } = useEventCounts(ocelId);
  const { data: objectCount } = useObjectCounts(ocelId);
  const { data: timeInfo } = useTimeInfo(ocelId);

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
    <Stack>
      <Title order={2}>Overview</Title>
      <Table>
        <Table.Tbody>
          <Table.Tr>
            <Table.Td>Name:</Table.Td>
            <Table.Td>{ocel.name}</Table.Td>
          </Table.Tr>
          <Table.Tr>
            <Table.Td>Events:</Table.Td>
            <Table.Td>{`${totalEventCount} of ${Object.keys(eventCounts ?? {}).length} activities`}</Table.Td>
          </Table.Tr>
          <Table.Tr>
            <Table.Td>Objects:</Table.Td>
            <Table.Td>{`${totalObjectCount} of ${Object.keys(objectCount ?? {}).length} activities`}</Table.Td>
          </Table.Tr>
          <Table.Tr>
            <Table.Td>Timeframe:</Table.Td>
            <Table.Td>
              {`${dayjs(timeInfo?.start_time).format("YYYY-MM-DD HH:mm")} - ${dayjs(timeInfo?.end_time).format("YYYY-MM-DD HH:mm")}`}
            </Table.Td>
          </Table.Tr>
          {ocel.extensions.length > 0 && (
            <Table.Tr>
              <Table.Td>Extensions:</Table.Td>
              <Table.Td>
                {ocel.extensions.map(({ label }) => (
                  <Badge>{label}</Badge>
                ))}
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>
    </Stack>
  );
};

export default OCELInfo;
