import z from "zod";

const SystemNotification = z.object({
  type: z.literal("notification"),
  title: z.string(),
  message: z.string(),
  notification_type: z.enum(["warning", "info", "error"]),
});

const InvalidationRequest = z.object({
  type: z.literal("invalidation"),
  routes: z.array(
    z.enum(["ocels", "resources", "tasks", "plugins", "discoveryMethods"]),
  ),
});

const ErrorNotification = z.object({
  type: z.literal("error"),
  title: z.string(),
  message: z.string(),
  trace: z.string(),
});

export const ServerEventMessage = z.discriminatedUnion("type", [
  SystemNotification,
  InvalidationRequest,
  ErrorNotification,
]);
