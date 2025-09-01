import { WebSocketMessage } from "@/lib/websocket/validator";
import useSessionStore from "@/store/sessionStore";
import { env } from "@/util/env";
import { showNotification } from "@mantine/notifications";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import useWebsocket from "react-use-websocket";

const WebsocketWrapper = () => {
  const queryClient = useQueryClient();
  const { sessionId } = useSessionStore();

  const { lastJsonMessage } = useWebsocket(
    env.websocketUrl,
    {
      queryParams: { session_id: sessionId! },
      retryOnError: true,
      reconnectInterval: 1000,
      share: true,
    },
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
        queryClient.invalidateQueries({
          predicate: (query) =>
            typeof query.queryKey[0] === "string" &&
            message.routes.some((route) =>
              (query.queryKey[0] as string).includes(`/${route}`),
            ),
        });
    }
  }, [lastJsonMessage]);

  return null;
};

export default WebsocketWrapper;
