import {
  AppShell as MAppShell,
  Burger,
  Group,
  Text,
  UnstyledButton,
  Box,
  Button,
  Modal,
  Stack,
  Divider,
  NavLink,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useRouter } from "next/router";
import classes from "@/components/AppShell/AppShell.module.css";
import { useState } from "react";
import { HomeIcon, LogOutIcon, PackageIcon, UploadIcon } from "lucide-react";
import Link from "next/link";
import { useLogout } from "@/api/fastapi/session/session";
import { useQueryClient } from "@tanstack/react-query";
import CurrentOcelSelect from "../CurrentOcelSelect/CurrentOcelSelect";
import useClient from "@/hooks/useClient";
import UploadModal from "../UploadModal/UploadModal";
import { useGetOcels } from "@/api/fastapi/ocels/ocels";
import config from "@/ocelescope.config";
import getModuleRoute from "@/lib/modules/getModuleRoute";
import useModulePath from "@/hooks/useModulePath";

const LogoutButton: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const queryClient = useQueryClient();
  const { push } = useRouter();
  const { mutate: logout } = useLogout({
    mutation: {
      onSuccess: () => {
        queryClient.clear();
        setIsModalOpen(false);
        push("/");
      },
    },
  });

  return (
    <>
      <Modal
        opened={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Are you sure?"
      >
        <Text>
          If you leave now, all your data and progress will be{" "}
          <strong>deleted permanently</strong>. This action cannot be undone.
        </Text>

        <Button
          color="red"
          mt="md"
          onClick={() => {
            logout();
          }}
          fullWidth
        >
          Accept
        </Button>
      </Modal>
      <UnstyledButton
        className={classes.button}
        onClick={() => setIsModalOpen(true)}
      >
        <Group justify={"space-between"} w={"100%"}>
          <Text style={{ lineHeight: 1 }}>Logout</Text>
          <LogOutIcon className={classes.buttonIcon} />
        </Group>
      </UnstyledButton>
    </>
  );
};

const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mobileOpened, { toggle: toggleMobile }] = useDisclosure(true);
  const [desktopOpened, { toggle: toggleDesktop }] = useDisclosure(true);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const router = useRouter();

  const isClient = useClient();

  const modulePath = useModulePath();
  const { data: ocels } = useGetOcels();

  const isOcelAvailable = ocels?.length !== 0;

  return (
    <MAppShell
      header={{ height: 60 }}
      navbar={{
        width: 300,
        breakpoint: "sm",
        collapsed: { mobile: !mobileOpened, desktop: !desktopOpened },
      }}
      padding="md"
    >
      <MAppShell.Header>
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
            {isClient && <CurrentOcelSelect />}
            <Button
              leftSection={<UploadIcon size={18} />}
              onClick={() => setIsUploadModalOpen(true)}
            >
              Upload
            </Button>
            <UploadModal
              isOpen={isUploadModalOpen}
              onClose={() => setIsUploadModalOpen(false)}
            />
          </Group>
        </Group>
      </MAppShell.Header>
      <MAppShell.Navbar className={classes.navbar}>
        <Stack justify="space-between" h={"100%"} gap={0}>
          <Stack gap={0} flex={1}>
            <NavLink
              component={Link}
              href="/"
              label="Home"
              leftSection={<HomeIcon size={16} />}
              active={router.asPath === "/"}
            />
            <Divider />
            {config.modules.map(
              ({ label, name, icon: Icon = PackageIcon, routes }) => {
                const isModuleDisabled =
                  !Object.values(routes).some(
                    ({ requiresOcel }) => !requiresOcel,
                  ) && !isOcelAvailable;

                return (
                  <NavLink
                    key={name}
                    leftSection={<Icon width={18} height={18} size={18} />}
                    label={label}
                    defaultOpened={name === modulePath?.moduleName}
                    component={Link}
                    href={getModuleRoute({
                      moduleName: name,
                      routeName: routes[0].name,
                    })}
                    disabled={isModuleDisabled}
                    opened={!isModuleDisabled ? undefined : false}
                    active={
                      Object.keys(routes).length === 1 &&
                      name === modulePath?.moduleName
                    }
                  >
                    {Object.keys(routes).length > 1 &&
                      Object.values(routes).map(
                        ({
                          label: routeLabel,
                          name: routeName,
                          requiresOcel,
                        }) => (
                          <NavLink
                            key={routeName}
                            label={routeLabel}
                            href={getModuleRoute({
                              moduleName: name,
                              routeName: routeName,
                            })}
                            disabled={requiresOcel && !isOcelAvailable}
                            component={Link}
                            active={
                              name === modulePath?.moduleName &&
                              routeName === modulePath.moduleName
                            }
                          />
                        ),
                      )}
                  </NavLink>
                );
              },
            )}
          </Stack>
          <Divider />
          <LogoutButton />
        </Stack>
      </MAppShell.Navbar>
      <MAppShell.Main
        style={{ overflow: "hidden" }}
        h="calc(100dvh - var(--app-shell-header-offset, 0rem) - var(--app-shell-footer-height, 0px) + var(--app-shell-padding, 0))"
      >
        <Box h={"100%"} style={{ overflow: "scroll", position: "relative" }}>
          {children}
        </Box>
      </MAppShell.Main>
    </MAppShell>
  );
};

export default AppShell;
