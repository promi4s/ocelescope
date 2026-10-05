/**
 * A playground for core's pickers, at /pickers: every picker, as a dropdown or
 * a list, picking one value or many, with what it reports shown below it.
 * Needs an OCEL to be selected.
 */
import {
  ActivityPicker,
  AttributePicker,
  type AttributeRef,
  E2ORelationPicker,
  EventAttributePicker,
  EventPicker,
  O2ORelationPicker,
  ObjectAttributePicker,
  ObjectPicker,
  ObjectTypePicker,
  OptionPicker,
  type Relation,
} from "@ocelescope/core";
import { type ReactNode, useState } from "react";

const FRUIT = [
  { value: "apple", label: "Apple", count: 12 },
  { value: "banana", label: "Banana", count: 7 },
  { value: "cherry", label: "Cherry", count: 3 },
];

/** One picker's selection, held both ways so the switch can flip between them. */
const useSelection = <T,>(multiple: boolean) => {
  const [one, setOne] = useState<T>();
  const [many, setMany] = useState<T[]>([]);
  return {
    value: multiple ? many : one,
    /** The single value, or the first of many: what narrows the next picker. */
    first: multiple ? many[0] : one,
    props: multiple
      ? { multiple: true as const, value: many, onChange: setMany }
      : { value: one, onChange: setOne },
  };
};

const Card = ({
  title,
  hint,
  value,
  children,
}: {
  title: string;
  hint?: string;
  value: unknown;
  children: ReactNode;
}) => (
  <section
    style={{
      display: "flex",
      flexDirection: "column",
      gap: 8,
      padding: 16,
      border: "1px solid #e5e5e5",
      borderRadius: 8,
      minWidth: 0,
    }}
  >
    <strong>{title}</strong>
    {hint && <small style={{ color: "#777" }}>{hint}</small>}
    {children}
    <pre
      style={{
        margin: 0,
        marginTop: "auto",
        padding: 8,
        fontSize: 11,
        background: "#f6f6f6",
        borderRadius: 4,
        overflow: "auto",
      }}
    >
      {JSON.stringify(value ?? null, null, 1)}
    </pre>
  </section>
);

export default function Pickers() {
  const [variant, setVariant] = useState<"dropdown" | "list">("dropdown");
  const [multiple, setMultiple] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const common = { variant, disabled };

  const activity = useSelection<string>(multiple);
  const objectType = useSelection<string>(multiple);
  const event = useSelection<string>(multiple);
  const object = useSelection<string>(multiple);
  const eventAttribute = useSelection<string>(multiple);
  const objectAttribute = useSelection<string>(multiple);
  const attribute = useSelection<AttributeRef>(multiple);
  const e2o = useSelection<Relation>(multiple);
  const o2o = useSelection<Relation>(multiple);
  const option = useSelection<string>(multiple);

  return (
    <div style={{ height: "100%", overflow: "auto", padding: 24 }}>
      <h2 style={{ marginTop: 0 }}>Pickers</h2>
      <div style={{ display: "flex", gap: 24, marginBottom: 16 }}>
        <label>
          Variant{" "}
          <select
            value={variant}
            onChange={(e) => setVariant(e.target.value as typeof variant)}
          >
            <option value="dropdown">dropdown</option>
            <option value="list">list</option>
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={multiple}
            onChange={(e) => setMultiple(e.target.checked)}
          />{" "}
          multiple
        </label>
        <label>
          <input
            type="checkbox"
            checked={disabled}
            onChange={(e) => setDisabled(e.target.checked)}
          />{" "}
          disabled
        </label>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          gap: 16,
        }}
      >
        <Card title="ActivityPicker" value={activity.value}>
          <ActivityPicker label="Activity" {...common} {...activity.props} />
        </Card>
        <Card title="ObjectTypePicker" value={objectType.value}>
          <ObjectTypePicker
            label="Object type"
            {...common}
            {...objectType.props}
          />
        </Card>
        <Card title="EventPicker" hint="Server-side search" value={event.value}>
          <EventPicker label="Event" {...common} {...event.props} />
        </Card>
        <Card
          title="ObjectPicker"
          hint="Server-side search"
          value={object.value}
        >
          <ObjectPicker label="Object" {...common} {...object.props} />
        </Card>
        <Card
          title="EventAttributePicker"
          hint="Narrowed to the activity picked above, if any"
          value={eventAttribute.value}
        >
          <EventAttributePicker
            label="Event attribute"
            activity={activity.first}
            {...common}
            {...eventAttribute.props}
          />
        </Card>
        <Card
          title="ObjectAttributePicker"
          hint="Narrowed to the object type picked above, if any"
          value={objectAttribute.value}
        >
          <ObjectAttributePicker
            label="Object attribute"
            objectType={objectType.first}
            {...common}
            {...objectAttribute.props}
          />
        </Card>
        <Card
          title="AttributePicker"
          hint="Needs the activity picked above"
          value={attribute.value}
        >
          <AttributePicker
            label="Attribute"
            activity={activity.first}
            {...common}
            {...attribute.props}
          />
        </Card>
        <Card
          title="E2ORelationPicker"
          hint="Narrowed to the activity picked above; grouped without one"
          value={e2o.value}
        >
          <E2ORelationPicker
            label="E2O relation"
            activity={activity.first}
            {...common}
            {...e2o.props}
          />
        </Card>
        <Card
          title="O2ORelationPicker"
          hint="Narrowed to the object type picked above; grouped without one"
          value={o2o.value}
        >
          <O2ORelationPicker
            label="O2O relation"
            objectType={objectType.first}
            {...common}
            {...o2o.props}
          />
        </Card>
        <Card
          title="OptionPicker"
          hint="The presentational core, with options of its own"
          value={option.value}
        >
          <OptionPicker<string>
            label="Fruit"
            options={FRUIT}
            {...common}
            {...option.props}
          />
        </Card>
      </div>
    </div>
  );
}
