import { useGetSystemTasks } from "@/api/fastapi/tasks/tasks";
import { hideNotification, showNotification } from "@mantine/notifications";
import { createContext, useContext, useEffect, useState } from "react";

type NotificationEntry = {
  id: string;
  tasks: string[];
  title: string;
  message?: string;
};

type NotificationContextType = {
  notifications: NotificationEntry[];
  addNotification: (taskNotification: Omit<NotificationEntry, "id">) => void;
};

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined,
);

const EMPTY_TASKS: any[] = [];

//TODO: Look if this can be done without  polling
export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [notifications, setNotifications] = useState<NotificationEntry[]>([]);

  const addNotification: NotificationContextType["addNotification"] = ({
    title,
    message,
    tasks,
  }) => {
    const notificationId = showNotification({ title, message, loading: true });
    setNotifications((prev) => [
      ...prev,
      { id: notificationId, message, tasks, title },
    ]);
  };

  const { data } = useGetSystemTasks(
    {
      only_running: false,
      task_ids: notifications.flatMap((notification) => notification.tasks),
    },
    {
      query: {
        enabled: notifications.length > 0,
        refetchInterval: 1000,
      },
    },
  );

  const tasks = data ?? EMPTY_TASKS;

  useEffect(() => {
    setNotifications((prev) => {
      const finished = prev.filter(
        (n) =>
          !n.tasks.some((taskId) =>
            tasks.some((t: any) => t.id === taskId && t.state === "STARTED"),
          ),
      );

      if (finished.length === 0) return prev; // no change, avoid rerender

      for (const { id } of finished) {
        try {
          hideNotification(id);
        } catch {}
      }

      const finishedIds = new Set(finished.map((f) => f.id));
      return prev.filter((n) => !finishedIds.has(n.id));
    });
  }, [tasks]);

  return (
    <NotificationContext.Provider value={{ notifications, addNotification }}>
      {children}
    </NotificationContext.Provider>
  );
};

export function useNotificationContext() {
  const ctx = useContext(NotificationContext);
  if (!ctx)
    throw new Error(
      "useNotificationContext must be used within NotificationProvider",
    );
  return ctx;
}
