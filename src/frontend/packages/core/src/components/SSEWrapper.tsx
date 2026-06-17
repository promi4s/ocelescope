import { CopyButton, Stack, Text } from "@mantine/core";
import { showNotification } from "@mantine/notifications";
import { env, useSessionStore } from "@ocelescope/api-client";
import { useEffect } from "react";
import { useInvalidate } from "../hooks/useInvalidate";
import { ServerEventMessage } from "../lib/sse";

const SSEWrapper = () => {
  const { sessionId } = useSessionStore();

  const invalidate = useInvalidate();

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    const es = new EventSource(`${env.event_url}?sessionId=${sessionId}`);

    es.onmessage = async (event) => {
      const result = ServerEventMessage.safeParse(JSON.parse(event.data));

      if (!result.success) {
        console.warn("Invalid SSE message", event.data, result.error);
        return;
      }

      const message = result.data;

      switch (message.type) {
        case "notification":
          showNotification({
            title: message.title,
            message: message.message,
            color: "green",
          });
          break;
        case "error":
          showNotification({
            title: message.title,
            color: "red",
            autoClose: 60000,
            message: (
              <Stack gap={6} align="flex-start">
                <Text size="sm" style={{ flex: 1 }} lineClamp={2}>
                  {message.message}
                </Text>

                <CopyButton value={message.trace ?? ""} timeout={1500}>
                  {({ copied, copy }) => (
                    <Text
                      size="xs"
                      c={copied ? "teal" : "red"}
                      td="underline"
                      style={{
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                        marginTop: 2,
                      }}
                      onClick={copy}
                    >
                      {copied ? "Copied" : "Copy trace"}
                    </Text>
                  )}
                </CopyButton>
              </Stack>
            ),
          });
          break;
        case "invalidation":
          await invalidate(message.routes);
      }
    };

    es.onerror = (err) => {
      console.error("SSE error:", err);
    };

    return () => es.close();
  }, [sessionId, invalidate]);

  return null;
};

export default SSEWrapper;
