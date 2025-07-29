import { useGetTask } from "@/api/fastapi/tasks/tasks";
import { useEffect, useRef, useState } from "react";

type UseTaskWaiterProps = {
  onSuccess?: () => void;
  taskId?: string;
};

const useWaitForTask = ({ taskId, onSuccess }: UseTaskWaiterProps) => {
  const [isTaskRunning, setIsTaskRunning] = useState(!!taskId);
  const hasCalledSuccess = useRef(false);

  // Reset the success flag when the task ID changes
  useEffect(() => {
    hasCalledSuccess.current = false;
  }, [taskId]);

  const { data: task } = useGetTask(taskId!, {
    query: {
      enabled: !!taskId,
      refetchInterval: ({ state }) =>
        state.data?.state === "SUCCESS" ? false : 2000,
    },
  });

  useEffect(() => {
    if (!task) return;

    if (task.state === "SUCCESS" && !hasCalledSuccess.current) {
      hasCalledSuccess.current = true;
      onSuccess?.();
      setIsTaskRunning(false);
    } else {
      setIsTaskRunning(true);
    }
  }, [task, onSuccess]);

  return { isTaskRunning, task };
};

export default useWaitForTask;
