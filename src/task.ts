import {
  ProcessExecution,
  ProcessExecutionOptions,
  Task,
  tasks,
  TaskScope,
} from "vscode";

export const TASK_DEFINITION_PREFIX = "shell-file-mode-task-";

// we can run multiple tasks by specifying a different task-definition type per task
let taskDefinitionCounter = 0;

export async function taskExec(
  name: string,
  prog: string,
  args: string[],
  options?: ProcessExecutionOptions
) {
  const procExec = new ProcessExecution(prog, args, options);
  const taskType = `${TASK_DEFINITION_PREFIX}${taskDefinitionCounter++}`;
  const task = new Task(
    { type: taskType },
    TaskScope.Workspace,
    name,
    "shell-file-mode",
    procExec
  );

  await tasks.executeTask(task);
}
