import { ActionIcon, Menu } from "@mantine/core";
import {
  CopyIcon,
  MoreVerticalIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react";

interface AnalysisCardActionsProps {
  onEdit: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
}

export function AnalysisCardActions({
  onEdit,
  onDuplicate,
  onRemove,
}: AnalysisCardActionsProps) {
  return (
    <Menu position="bottom-end" shadow="md">
      <Menu.Target>
        <ActionIcon
          variant="subtle"
          color="gray"
          size="sm"
          aria-label="Visualization actions"
        >
          <MoreVerticalIcon size={14} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item leftSection={<PencilIcon size={14} />} onClick={onEdit}>
          Edit
        </Menu.Item>
        <Menu.Item leftSection={<CopyIcon size={14} />} onClick={onDuplicate}>
          Duplicate
        </Menu.Item>
        <Menu.Divider />
        <Menu.Item
          color="red"
          leftSection={<Trash2Icon size={14} />}
          onClick={onRemove}
        >
          Remove
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
