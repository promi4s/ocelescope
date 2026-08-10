import { Box, Input, Slider } from "@mantine/core";
import type { FieldProps } from "@rjsf/utils";
import { memo, useMemo } from "react";

type SliderMeta = {
  min: number;
  max: number;
  step?: number;
  marks?: number[];
};

const decimalsOf = (step: number) => String(step).split(".")[1]?.length ?? 0;

export const SliderField = memo(
  ({
    schema,
    required,
    formData,
    onChange,
    rawErrors,
    disabled,
    readonly,
    fieldPathId: { path },
  }: FieldProps) => {
    const meta = schema["x-ui-meta"] as SliderMeta;

    const { min, max } = meta;

    const step =
      meta.step ?? (schema.type === "integer" ? 1 : (max - min) / 100);
    const decimals = decimalsOf(step);

    const marks = useMemo(
      () =>
        meta.marks?.map((value) => ({
          value,
          label: value.toFixed(decimals),
        })),
      [meta.marks, decimals],
    );

    const fallback = typeof schema.default === "number" ? schema.default : min;
    const value = typeof formData === "number" ? formData : fallback;

    return (
      <Input.Wrapper
        label={schema.title}
        description={schema.description}
        required={required}
        error={rawErrors?.[0]}
      >
        <Box px={marks ? "md" : undefined} pb={marks ? "xl" : undefined}>
          <Slider
            mt="xs"
            min={min}
            max={max}
            step={step}
            marks={marks}
            label={(current) => current.toFixed(decimals)}
            value={value}
            onChange={(current) => onChange(current, path)}
            disabled={disabled || readonly}
          />
        </Box>
      </Input.Wrapper>
    );
  },
);
