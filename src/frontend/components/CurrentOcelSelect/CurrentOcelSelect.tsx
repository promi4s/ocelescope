import useCurrentOcel from "@/hooks/useCurrentOcel";
import OcelSelect from "../OcelSelect/OcelSelect";

const CurrentOcelSelect: React.FC<{}> = () => {
  const { id, setCurrentOcel } = useCurrentOcel();

  return (
    <OcelSelect
      value={id}
      unselectable={"off"}
      onChange={(id) => {
        if (id) {
          setCurrentOcel(id);
        }
      }}
    />
  );
};

export default CurrentOcelSelect;
