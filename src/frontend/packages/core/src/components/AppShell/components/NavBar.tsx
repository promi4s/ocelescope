import {
  AppShell,
  Button,
  Divider,
  Group,
  Modal,
  NavLink,
  Stack,
  Text,
  UnstyledButton,
} from "@mantine/core";
import { useGetOcels, useLogout } from "@ocelescope/api-base";
import { HomeIcon, LogOutIcon, PackageIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/router";
import useModulePath from "../../../hooks/useModulePath";
import type { OcelescopeConfig } from "../../../lib/config";
import { getModuleRoute } from "../../../lib/getModuleRoute";
import classes from "../AppShell.module.css";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

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
        className={classes.button ?? ""}
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

const NavBar: React.FC<{ config: OcelescopeConfig }> = ({ config }) => {
  const { modules = [] } = config;
  const router = useRouter();

  const modulePath = useModulePath(config);
  const { data: ocels } = useGetOcels();

  const isOcelAvailable = ocels?.length !== 0;

  return (
    <AppShell.Navbar className={classes["navbar"] ?? ""}>
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
          {modules.map(({ label, name, icon: Icon = PackageIcon, routes }) => {
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
                  routeName: routes[0]?.name ?? "",
                })}
                disabled={isModuleDisabled}
                {...(isModuleDisabled ? { opened: false } : {})}
                active={
                  Object.keys(routes).length === 1 &&
                  name === modulePath?.moduleName
                }
              >
                {Object.keys(routes).length > 1 &&
                  Object.values(routes).map(
                    ({ label: routeLabel, name: routeName, requiresOcel }) => (
                      <NavLink
                        key={routeName}
                        label={routeLabel}
                        href={getModuleRoute({
                          moduleName: name,
                          routeName: routeName,
                        })}
                        disabled={!!requiresOcel && !isOcelAvailable}
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
          })}
        </Stack>
        <Divider />
        <LogoutButton />
      </Stack>
    </AppShell.Navbar>
  );
};

export default NavBar;
