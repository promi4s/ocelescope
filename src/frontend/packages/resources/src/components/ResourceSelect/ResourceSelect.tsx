import {
  ActionIcon,
  type ComboboxItem,
  FileButton,
  Tooltip,
} from "@mantine/core";
import { useResources, useUpload } from "@ocelescope/api-base";
import { EyeIcon, UploadIcon } from "lucide-react";
import { useEffect, useEffectEvent, useMemo, useState } from "react";
import {
  ActionSelect,
  type ActionSelectProps,
} from "../ActionSelect/ActionSelect";
import { ResourceModal } from "../ResourceModal/ResourceModal";

export type ResourceSelectProps = ActionSelectProps & {
  type?: string;
  withUpload?: boolean;
  withView?: boolean;
};

const useResourceOptions = (
  type: string | undefined,
  onUploaded: (uploaded: ComboboxItem[]) => void,
) => {
  const { data: resources = [] } = useResources({ schema_hash: type ?? null });
  const [pendingTaskIds, setPendingTaskIds] = useState<string[]>([]);

  const options = useMemo(
    () => resources.map(({ name, id }) => ({ value: id, label: name })),
    [resources],
  );

  const handleUploaded = useEffectEvent(onUploaded);

  useEffect(() => {
    const uploaded = resources.filter(
      ({ source_id }) => source_id && pendingTaskIds.includes(source_id),
    );

    if (!uploaded.length) {
      return;
    }

    setPendingTaskIds((taskIds) =>
      taskIds.filter(
        (taskId) => !uploaded.some(({ source_id }) => source_id === taskId),
      ),
    );
    handleUploaded(
      uploaded.map(({ id, name }) => ({ value: id, label: name })),
    );
  }, [resources, pendingTaskIds]);

  const trackUpload = (taskIds: string[]) =>
    setPendingTaskIds((pending) => [...pending, ...taskIds]);

  return { options, trackUpload };
};

const UploadButton: React.FC<{
  disabled?: boolean;
  onUpload: (taskIds: string[]) => void;
}> = ({ disabled, onUpload }) => {
  const { mutate: upload, isPending } = useUpload({
    mutation: { onSuccess: onUpload },
  });

  return (
    <FileButton
      accept=".ocelescope"
      multiple
      onChange={(files) => {
        if (files.length) {
          upload({ data: { files } });
        }
      }}
    >
      {(props) => (
        <Tooltip label="Upload resource" withArrow>
          <ActionIcon
            {...props}
            size="input-sm"
            loading={isPending}
            disabled={disabled}
            aria-label="Upload resource"
          >
            <UploadIcon size={16} />
          </ActionIcon>
        </Tooltip>
      )}
    </FileButton>
  );
};

const ViewButton: React.FC<{
  resourceId: string | null;
  onView: (id: string) => void;
}> = ({ resourceId, onView }) => (
  <Tooltip
    label={resourceId ? "View resource" : "Select a resource to view it"}
    withArrow
  >
    <ActionIcon
      variant="default"
      size="input-sm"
      data-disabled={!resourceId || undefined}
      aria-disabled={!resourceId}
      onClick={resourceId ? () => onView(resourceId) : undefined}
      aria-label="View resource"
    >
      <EyeIcon size={16} />
    </ActionIcon>
  </Tooltip>
);

export const ResourceSelect: React.FC<ResourceSelectProps> = (props) => {
  const { type, withUpload = true, withView = true, ...selectProps } = props;
  const [viewedId, setViewedId] = useState<string>();

  const { options, trackUpload } = useResourceOptions(type, (uploaded) => {
    if (props.multiple) {
      props.onChange([
        ...new Set([...props.value, ...uploaded.map(({ value }) => value)]),
      ]);
    } else if (uploaded[0]) {
      props.onChange(uploaded[0].value, uploaded[0]);
    }
  });

  const viewId = props.multiple ? null : props.value;
  const showView = withView && !props.multiple;

  return (
    <>
      <ActionSelect
        {...selectProps}
        data={options}
        actions={
          (showView || withUpload) && (
            <>
              {showView && (
                <ViewButton resourceId={viewId} onView={setViewedId} />
              )}
              {withUpload && (
                <UploadButton
                  disabled={props.disabled}
                  onUpload={trackUpload}
                />
              )}
            </>
          )
        }
      />
      {viewedId && (
        <ResourceModal id={viewedId} onClose={() => setViewedId(undefined)} />
      )}
    </>
  );
};
