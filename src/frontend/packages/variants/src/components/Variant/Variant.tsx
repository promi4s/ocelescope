import { generateColor } from "@marko19907/string-to-color";
import { useMemo } from "react";
import styles from "./Variant.module.css";

export const Variant: React.FC<{
  variant: string[];
  colors?: Record<string, string>;
}> = ({ variant, colors = {} }) => {
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

  return (
    <ul className={styles.variant}>
      {variant.map((activity, index) => (
        <li
          key={`${activity}_${index}`}
          className={styles.item}
          style={{ "--c": colorMap[activity] } as React.CSSProperties}
        >
          <span>{activity}</span>
        </li>
      ))}
    </ul>
  );
};
