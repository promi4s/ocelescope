import { Anchor, Group, Modal, Stack, Text } from "@mantine/core";
import {
  BookOpenIcon,
  BugIcon,
  GlobeIcon,
  LightbulbIcon,
  type LucideIcon,
  MailIcon,
  PackagePlusIcon,
  PuzzleIcon,
  TriangleAlertIcon,
  UploadIcon,
} from "lucide-react";
import { env } from "../../lib/env";

const HelpLink: React.FC<{
  icon: LucideIcon;
  label: string;
  href: string;
}> = ({ icon: Icon, label, href }) => (
  <Anchor
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    underline="never"
    c="inherit"
  >
    <Group gap="sm">
      <Icon size={18} />
      <Text size="sm">{label}</Text>
    </Group>
  </Anchor>
);

export const HelpModal: React.FC<{
  visible: boolean;
  onClose: () => void;
}> = ({ visible, onClose }) => {
  return (
    <Modal
      title={<Text size={"h3"}>Help</Text>}
      opened={visible}
      onClose={onClose}
    >
      <Stack gap="sm">
        <HelpLink icon={GlobeIcon} label="Website" href={env.projectPage} />
        <HelpLink
          icon={BookOpenIcon}
          label="Documentation"
          href={env.docsUrl}
        />
        <HelpLink
          icon={PuzzleIcon}
          label="Plugin development guide"
          href={env.pluginDevGuideUrl}
        />
        <HelpLink
          icon={TriangleAlertIcon}
          label="Known issues"
          href={env.troubleshootingUrl}
        />
        <HelpLink icon={BugIcon} label="Report a bug" href={env.reportBugUrl} />
        <HelpLink
          icon={LightbulbIcon}
          label="Request a feature"
          href={env.requestFeatureUrl}
        />
        <HelpLink
          icon={UploadIcon}
          label="Submit a plugin"
          href={env.submitPluginUrl}
        />
        <HelpLink
          icon={PackagePlusIcon}
          label="Request environment addition"
          href={env.requestEnvironmentUrl}
        />
        <HelpLink
          icon={MailIcon}
          label={env.contactEmail}
          href={`mailto:${env.contactEmail}`}
        />
      </Stack>
    </Modal>
  );
};
