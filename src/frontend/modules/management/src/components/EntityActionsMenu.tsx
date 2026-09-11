import { ActionIcon, Loader, Menu, MenuItem } from "@mantine/core";
import { DownloadOCELExt } from "@ocelescope/api-base";
import {
  DownloadIcon,
  EllipsisVerticalIcon,
  EyeIcon,
  PencilIcon,
  TrashIcon,
} from "lucide-react";
import { memo } from "react";
import type { Entity } from "../types";

const ocelExtensions = Object.values(DownloadOCELExt);

export type OcelExtension = DownloadOCELExt;

type EntityActionsMenuProps = {
  entity: Entity;
  onRename: (entity: Entity) => void;
  onInspect: (id: string) => void;
  onDownloadOcel: (id: string, extension: OcelExtension) => void;
  onExportAsXes: (id: string) => void;
  onDownloadResource: (id: string) => void;
  onDownloadResourceAsPnml: (id: string) => void;
  onDelete: (id: string, type: Entity["type"]) => void;
};

const EntityActionsMenu: React.FC<EntityActionsMenuProps> = ({
  entity,
  onRename,
  onInspect,
  onDownloadOcel,
  onExportAsXes,
  onDownloadResource,
  onDownloadResourceAsPnml,
  onDelete,
}) => {
  const { id, type, entityTypeName, isUploading } = entity;

  if (isUploading) {
    return <Loader size={20} />;
  }

  return (
    <Menu width={200} position="left-start">
      <Menu.Target>
        <ActionIcon variant="subtle" onClick={(e) => e.stopPropagation()}>
          <EllipsisVerticalIcon size={20} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown onClick={(e) => e.stopPropagation()}>
        <Menu.Item
          leftSection={<PencilIcon size={16} />}
          onClick={() => onRename(entity)}
        >
          Rename
        </Menu.Item>
        {type === "resource" && (
          <MenuItem
            leftSection={<EyeIcon size={16} />}
            onClick={() => onInspect(id)}
          >
            Inspect
          </MenuItem>
        )}
        {type === "ocel" ? (
          <Menu.Sub position="right-start">
            <Menu.Sub.Target>
              <Menu.Sub.Item leftSection={<DownloadIcon size={16} />}>
                Download
              </Menu.Sub.Item>
            </Menu.Sub.Target>
            <Menu.Sub.Dropdown>
              {ocelExtensions.map((extension) => (
                <Menu.Item
                  key={extension}
                  onClick={() => onDownloadOcel(id, extension)}
                >
                  {extension}
                </Menu.Item>
              ))}
              <Menu.Item key={".xes"} onClick={() => onExportAsXes(id)}>
                {".xes"}
              </Menu.Item>
            </Menu.Sub.Dropdown>
          </Menu.Sub>
        ) : entityTypeName === "Petri Net" ? (
          <Menu.Sub position="right-start">
            <Menu.Sub.Target>
              <Menu.Sub.Item leftSection={<DownloadIcon size={16} />}>
                Download
              </Menu.Sub.Item>
            </Menu.Sub.Target>
            <Menu.Sub.Dropdown>
              <Menu.Item onClick={() => onDownloadResource(id)}>
                .ocelescope
              </Menu.Item>
              <Menu.Item onClick={() => onDownloadResourceAsPnml(id)}>
                .pnml
              </Menu.Item>
            </Menu.Sub.Dropdown>
          </Menu.Sub>
        ) : (
          <Menu.Item
            onClick={() => onDownloadResource(id)}
            leftSection={<DownloadIcon size={16} />}
          >
            Download
          </Menu.Item>
        )}
        <Menu.Divider />
        <Menu.Item
          leftSection={<TrashIcon size={16} color={"red"} />}
          color="red"
          fw="bold"
          onClick={() => onDelete(id, type)}
        >
          Delete
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
};

export default memo(EntityActionsMenu);
