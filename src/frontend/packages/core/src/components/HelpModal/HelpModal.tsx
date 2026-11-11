import {
  Anchor,
  Button,
  CopyButton,
  Divider,
  Group,
  Modal,
  Stack,
  Text,
} from "@mantine/core";
import {
  BookOpenIcon,
  BugIcon,
  CheckIcon,
  CopyIcon,
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

// cspell:disable
const PAPER_URL = "https://ceur-ws.org/Vol-4274/paper-30.pdf";

const BIB_ENTRY = String.raw`@inproceedings{ocelescope2026,
  title     = {Ocelescope: An Extensible Web Framework for Object-Centric Process Mining},
  author    = {{\"O}zt{\"u}rk, G{\"o}rkem-Emre and Graves, Nina and K{\"u}sters, Aaron and Menne, Sebastian and van der Aalst, Wil M. P.},
  booktitle = {Joint Proceedings of the Best Dissertation Award, Doctoral Consortium, and Demonstration \& Resources Forum at BPM 2026},
  series    = {CEUR Workshop Proceedings},
  volume    = {4274},
  pages     = {173--177},
  publisher = {CEUR-WS.org},
  year      = {2026},
  url       = {${PAPER_URL}}
}`;
// cspell:enable

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
        <Divider label="Cite Ocelescope" labelPosition="left" mt="xs" />
        {/* cspell:disable */}
        <Text size="xs" c="dimmed">
          Öztürk, G.-E., Graves, N., Küsters, A., Menne, S., & van der Aalst, W.
          M. P. (2026). Ocelescope: An extensible web framework for
          object-centric process mining. <i>CEUR Workshop Proceedings</i>,{" "}
          <i>4274</i>, 173–177.{" "}
          <Anchor href={PAPER_URL} target="_blank" rel="noopener noreferrer">
            {PAPER_URL}
          </Anchor>
        </Text>
        {/* cspell:enable */}
        <Group gap="xs">
          <CopyButton value={BIB_ENTRY}>
            {({ copied, copy }) => (
              <Button
                size="xs"
                variant="light"
                color={copied ? "teal" : undefined}
                leftSection={
                  copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />
                }
                onClick={copy}
              >
                {copied ? "Copied" : "Copy BibTeX"}
              </Button>
            )}
          </CopyButton>
        </Group>
      </Stack>
    </Modal>
  );
};
