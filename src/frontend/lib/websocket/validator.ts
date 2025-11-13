import z from "zod";

const OCELLink = z.object({
  type: z.literal("ocel"),
  ocel_id: z.string(),
});

const ResourceLink = z.object({
  type: z.literal("resource"),
  resource_id: z.string(),
});

const PluginLink = z.object({
  type: z.literal("plugin"),
  name: z.string(),
  method: z.string(),
  task_id: z.string(),
});

const SystemLink = z.discriminatedUnion("type", [
  OCELLink,
  ResourceLink,
  PluginLink,
]);

const SystemNotification = z.object({
  type: z.literal("notification"),
  title: z.string(),
  message: z.string(),
  notification_type: z.enum(["warning", "info", "error"]),
  link: SystemLink,
});

const InvalidationRequest = z.object({
  type: z.literal("invalidation"),
  routes: z.array(z.enum(["ocels", "resources", "tasks", "plugins"])),
});

export const ServerEventMessage = z.discriminatedUnion("type", [
  SystemNotification,
  InvalidationRequest,
]);
