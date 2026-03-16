import { showNotification } from "@mantine/notifications";
import { env, useSessionStore } from "@ocelescope/api-client";
import { useEffect } from "react";
import useInvalidate from "../hooks/useInvalidate";
import { ServerEventMessage } from "../lib/sse";

const SSEWrapper = () => {
  const { sessionId } = useSessionStore();

  const invalidate = useInvalidate();

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    const es = new EventSource(`${env.event_url}?sessionId=${sessionId}`);

    //TODO: Use message names
    es.onmessage = (event) => {
      const result = ServerEventMessage.safeParse(JSON.parse(event.data));

      if (!result.success) {
        console.warn("Invalid SSE message", result.error);
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
        case "invalidation":
          invalidate(message.routes);
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
