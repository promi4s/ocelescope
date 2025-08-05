import { useGetOcels } from "@/api/fastapi/ocels/ocels";
import {
  Menu,
  Stack,
  Group,
  Text,
  LoadingOverlay,
  UnstyledButton,
} from "@mantine/core";
import { ArrowLeftRightIcon, ChevronRight, FilterIcon } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import classes from "../AppShell/AppShell.module.css";

const CurrentOcelMenu: React.FC = () => {
  const { data } = useGetOcels({});

  const currentOcel = useMemo(() => {
    if (!data?.current_ocel_id) {
      return;
    }
    const { current_ocel_id, ocels } = data;

    return ocels.find(({ id }) => id === current_ocel_id);
  }, [data?.current_ocel_id, data?.ocels]);

  return (
    <Menu position="right-start" width={200}>
      <Menu.Target>
        <Stack gap={0}>
          <UnstyledButton px={"md"} pt={"md"} className={classes.button}>
            <Group pos={"relative"}>
              <LoadingOverlay visible={!data} />
              <Stack flex={1} gap={"xs"}>
                {currentOcel ? (
                  <>
                    <Text size={"sm"}>{currentOcel.name}</Text>
                    <Text size="xs">{currentOcel.created_at}</Text>
                  </>
                ) : (
                  <Text>No Ocel Selected</Text>
                )}
              </Stack>
              <ChevronRight className={classes.buttonIcon} />
            </Group>
          </UnstyledButton>
        </Stack>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item
          component={Link}
          href={`/filter/${currentOcel?.id}`}
          disabled={!currentOcel}
          leftSection={<FilterIcon size={16} />}
        >
          Filter
        </Menu.Item>
        <Menu.Item
          component={Link}
          href="/"
          leftSection={<ArrowLeftRightIcon size={16} />}
        >
          Change Ocel
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
};

export default CurrentOcelMenu;
