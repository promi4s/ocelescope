import { softBadgeStyle } from "@r4pm/components";
import { Badge, Flex, Text, Theme } from "@r4pm/components/ui";
import { XIcon } from "lucide-react";
import type { ReactNode } from "react";

/**
 * A picker's label and help text above it.
 *
 * Its own Radix theme, since a Mantine modal is portalled outside the app's:
 * there the Radix parts would lose their styles. Within the app's theme it
 * only inherits it.
 */
export const Field = ({
  label,
  description,
  children,
}: {
  label?: string;
  description?: string;
  children: ReactNode;
}) => (
  <Theme asChild hasBackground={false}>
    <Flex direction="column" gap="1" width="100%">
      {label && (
        <Text as="div" size="2" weight="medium">
          {label}
        </Text>
      )}
      {description && (
        <Text as="div" size="1" color="gray">
          {description}
        </Text>
      )}
      {children}
    </Flex>
  </Theme>
);

/** A dot in a choice's colour. */
export const Swatch = ({ color }: { color?: string }) =>
  color ? (
    <span
      aria-hidden
      style={{
        flex: "none",
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: color,
      }}
    />
  ) : null;

/** Picked values as badges, each with a button that takes it out. */
export const PickedBadges = ({
  picked,
  onRemove,
  disabled,
}: {
  picked: readonly { id: string; label: string; color?: string }[];
  onRemove: (id: string) => void;
  disabled?: boolean;
}) =>
  picked.length === 0 ? null : (
    <Flex gap="1" wrap="wrap">
      {picked.map(({ id, label, color }) => (
        <Badge
          key={id}
          size="1"
          style={color ? softBadgeStyle(color) : undefined}
          color={color ? undefined : "gray"}
        >
          {label}
          {!disabled && (
            <XIcon
              size={12}
              role="button"
              tabIndex={0}
              aria-label={`Remove ${label}`}
              style={{ cursor: "pointer" }}
              onClick={() => onRemove(id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onRemove(id);
                }
              }}
            />
          )}
        </Badge>
      ))}
    </Flex>
  );
