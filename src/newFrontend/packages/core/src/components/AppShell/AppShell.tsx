import {
  Burger,
  Button,
  Group,
  AppShell as MantineAppShell,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { UploadIcon } from "lucide-react";
import { useState } from "react";
import { CurrentOcelSelect } from "../OcelSelect/OcelSelect";
import UploadModal from "../UploadModal/UploadModal";

export const AppShell: React.FC<{ children?: React.ReactNode }> = ({
  children,
}) => {
  const [mobileOpened, { toggle: toggleMobile }] = useDisclosure(true);
  const [desktopOpened, { toggle: toggleDesktop }] = useDisclosure(true);

  const [isUploadModalVisible, setIsUploadModalVisible] = useState(false);

  return (
    <MantineAppShell
      header={{ height: 60 }}
      navbar={{
        width: 300,
        breakpoint: "sm",
        collapsed: { mobile: !mobileOpened, desktop: !desktopOpened },
      }}
      padding="md"
    >
      <MantineAppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group align="center">
            <Burger
              opened={mobileOpened}
              onClick={toggleMobile}
              hiddenFrom="sm"
              size="sm"
            />
            <Burger
              opened={desktopOpened}
              onClick={toggleDesktop}
              visibleFrom="sm"
              size="sm"
            />
          </Group>

          <Group>
            <CurrentOcelSelect />
            <Button
              leftSection={<UploadIcon size={18} />}
              onClick={() => setIsUploadModalVisible(true)}
            >
              Upload
            </Button>
            <UploadModal
              visible={isUploadModalVisible}
              onClose={() => setIsUploadModalVisible(false)}
            />
          </Group>
        </Group>
      </MantineAppShell.Header>
      <MantineAppShell.Navbar />
      <MantineAppShell.Main>{children}</MantineAppShell.Main>
    </MantineAppShell>
  );
};
