import { SegmentedControl, Stack } from "@mantine/core";
import type { DistributionViewProps, PreviewProps } from "../../util";
import PatternView from "./PatternView";
import ValuePicker from "./ValuePicker";

const PICKER_OPTIONS = [
  { label: "Pick values", value: "values" },
  { label: "Pattern", value: "pattern" },
];

const ValuesView: React.FC<DistributionViewProps & PreviewProps> = (props) => {
  const { filter, onChange } = props;
  const picker = filter.regex != null ? "pattern" : "values";

  return (
    <Stack gap="sm" flex={1} mih={0}>
      <SegmentedControl
        size="xs"
        w="fit-content"
        value={picker}
        data={PICKER_OPTIONS}
        onChange={(next) =>
          onChange({
            ...filter,
            values: null,
            regex: next === "pattern" ? "" : null,
          })
        }
      />
      {picker === "pattern" ? (
        <PatternView {...props} />
      ) : (
        <ValuePicker {...props} />
      )}
    </Stack>
  );
};

export default ValuesView;
