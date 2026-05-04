import { generateColor } from "@marko19907/string-to-color";
import { XIcon } from "lucide-react";
import { useMemo } from "react";
import styles from "./Variant.module.css";

export const Variant: React.FC<{
  variant: string[];
  colors?: Record<string, string>;
  enableGrouping?: boolean;
}> = ({ variant, colors = {}, enableGrouping = false }) => {
  const colorMap = useMemo(
    () => ({
      ...colors,
      ...Object.fromEntries(
        variant
          .filter((activity) => !(activity in colors))
          .map((activity) => [activity, generateColor(activity)]),
      ),
    }),
    [variant, colors],
  );

  const groupedVariants = useMemo(
    () =>
      variant.reduce(
        (acc, curr) => {
          const lastElement = acc.at(-1);

          if (
            !enableGrouping ||
            !lastElement ||
            lastElement.activity !== curr
          ) {
            return [...acc, { activity: curr, freq: 1 }];
          }

          return [
            ...acc.slice(0, -1),
            { ...lastElement, freq: lastElement.freq + 1 },
          ];
        },
        [] as { activity: string; freq: number }[],
      ),
    [variant, enableGrouping],
  );

  return (
    <ul className={styles.variant}>
      {groupedVariants.map(({ freq, activity }, index) => (
        <li
          key={`${activity}_${index}`}
          className={styles.item}
          style={
            {
              "--c": colorMap[activity],
            } as React.CSSProperties
          }
        >
          {freq > 1 && (
            <>
              <span>{freq}</span>
              <XIcon size={14} />
            </>
          )}
          <span className={styles.itemLabel}>{activity}</span>
        </li>
      ))}
    </ul>
  );
};
