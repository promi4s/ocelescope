import useInvalidate from "@/hooks/useInvalidateResources";
import { WebSocketMessage } from "@/lib/websocket/validator";
import useSessionStore from "@/store/sessionStore";
import { env } from "@/util/env";
import { showNotification } from "@mantine/notifications";
import { useEffect } from "react";
import useWebsocket from "react-use-websocket";

const WebsocketWrapper = () => {
  const { sessionId } = useSessionStore();

  const invalidate = useInvalidate();

  const { lastJsonMessage } = useWebsocket(
    sessionId ? env.websocketUrl : null,
    sessionId
      ? {
          queryParams: { session_id: sessionId! },
          retryOnError: true,
          reconnectInterval: 1000,
          share: true,
        }
      : undefined,
    !!sessionId,
  );

  useEffect(() => {
    const result = WebSocketMessage.safeParse(lastJsonMessage);

    if (!result.success) {
      console.warn("Invalid WS message", result.error);
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
  }, [lastJsonMessage]);

  return null;
};

export default WebsocketWrapper;
