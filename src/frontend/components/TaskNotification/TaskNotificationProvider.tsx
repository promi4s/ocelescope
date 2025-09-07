// context/NotificationContext.tsx
import { useGetSystemTasks } from "@/api/fastapi/tasks/tasks";
import {
  hideNotification,
  showNotification,
  // updateNotification, // (unused)
} from "@mantine/notifications";
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

// stable empty array to avoid a new [] reference every render
const EMPTY_TASKS: any[] = [];

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

  // keep tasks reference stable when data is undefined
  const tasks = data ?? EMPTY_TASKS;

  useEffect(() => {
    // react to task updates; use functional update to avoid stale 'notifications'
    setNotifications((prev) => {
      // which notifications have all their tasks finished?
      const finished = prev.filter(
        (n) =>
          !n.tasks.some((taskId) =>
            tasks.some((t: any) => t.id === taskId && t.state === "STARTED"),
          ),
      );

      if (finished.length === 0) return prev; // no change, avoid rerender

      // hide finished notifications
      finished.forEach(({ id }) => {
        try {
          hideNotification(id);
        } catch {
          // ignore if already hidden
        }
      });

      const finishedIds = new Set(finished.map((f) => f.id));
      // IMPORTANT: return the filtered list (the bug was missing 'return')
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
