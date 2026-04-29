import { generateColor } from "@marko19907/string-to-color";
import styles from "./Variant.module.css";

export const Variant: React.FC<{ variant: string[] }> = ({ variant }) => {
  return (
    <ul className={styles.variant}>
      {variant.map((activity) => (
        <li
          className={styles.item}
          style={{ "--c": generateColor(activity) } as React.CSSProperties}
        >
          <span>{activity}</span>
        </li>
      ))}
    </ul>
  );
};
