import { SegmentedControl } from "@mantine/core";
import type { RelationFilter, RelationKind } from "../types";
import RelationDetail from "./RelationDetail";

type RelationCountDetailProps = {
  ocelId: string;
  viewId: string | null;
  kind: RelationKind;
  filter: RelationFilter;
  onChange: (filter: RelationFilter) => void;
  onClear: () => void;
};

const RelationCountDetail: React.FC<RelationCountDetailProps> = ({
  ocelId,
  viewId,
  kind,
  filter,
  onChange,
  onClear,
}) => {
  const direction = filter.direction ?? "source";
  const sides =
    kind === "e2o"
      ? { source: "event", target: "object" }
      : { source: filter.source, target: filter.target };
  const isSource = direction === "source";
  const countedNoun = kind === "e2o" && isSource ? "event" : "object";
  const relatedNoun = kind === "e2o" && !isSource ? "events" : "objects";

  return (
    <RelationDetail
      ocelId={ocelId}
      viewId={viewId}
      kind={kind}
      source={filter.source}
      target={filter.target}
      qualifier={filter.qualifier ?? null}
      direction={direction}
      range={filter.range}
      exclude={filter.mode === "exclude"}
      countedLabel={countedNoun === "event" ? "Events" : "Objects"}
      caption={`How many ${isSource ? filter.target : filter.source} ${relatedNoun} each ${isSource ? filter.source : filter.target} ${countedNoun} is related to`}
      onQualifierChange={(qualifier) => onChange({ ...filter, qualifier })}
      onRangeChange={(range) => onChange({ ...filter, range })}
      onClear={onClear}
    >
      <SegmentedControl
        size="xs"
        value={filter.mode ?? "include"}
        data={[
          { label: "Include", value: "include" },
          { label: "Exclude", value: "exclude" },
        ]}
        onChange={(next) =>
          onChange({ ...filter, mode: next as "include" | "exclude" })
        }
      />
      <SegmentedControl
        size="xs"
        value={direction}
        data={[
          { label: `Per ${sides.source}`, value: "source" },
          { label: `Per ${sides.target}`, value: "target" },
        ]}
        onChange={(next) =>
          onChange({
            ...filter,
            direction: next as "source" | "target",
            range: [null, null],
          })
        }
      />
    </RelationDetail>
  );
};

export default RelationCountDetail;
