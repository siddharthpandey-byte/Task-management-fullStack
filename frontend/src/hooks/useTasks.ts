import { taskService, toTaskParams } from "../api/services/task.service";
import type {
  BoardData,
  BoardQuery,
  Task,
  TaskListQuery,
  TaskListResult,
} from "../types/task.types";
import { useRemote } from "./useRemote";

// projectKey → one project's tasks; otherwise the cross-project list
export function useTasks(query: TaskListQuery, projectKey?: string) {
  return useRemote<TaskListResult>(
    (signal) => taskService.list(query, projectKey, signal),
    [toTaskParams(query), projectKey ?? null]
  );
}

// taskKey "" → nothing is loaded
export function useTask(taskKey: string) {
  return useRemote<Task>((signal) => taskService.get(taskKey, signal), [taskKey], taskKey !== "");
}

// one project's board; projectKey "" → nothing is loaded
export function useBoard(projectKey: string, query: BoardQuery) {
  return useRemote<BoardData>(
    (signal) => taskService.board(projectKey, query, signal),
    [projectKey, toTaskParams(query)],
    projectKey !== ""
  );
}
