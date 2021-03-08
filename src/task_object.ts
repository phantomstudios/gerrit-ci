const DEFAULT_ERROR_MESSAGE = (command: string) =>
    `🔴  Error: "${command}" failed`;
const DEFAULT_SUCCESS_MESSAGE = (command: string) =>
    `🟢  Success: "${command}" completed`;

export const TEST_ONLY = {DEFAULT_ERROR_MESSAGE, DEFAULT_SUCCESS_MESSAGE};

function getMessage<T>(taskMessage: unknown, defaultMessage = ''): T {
  const isFunction = typeof taskMessage === 'function';
  const wrapperFn = () => (taskMessage as string) || defaultMessage;

  return (isFunction ? taskMessage : wrapperFn) as T;
}

export interface TaskObject {
  command: string;
  errorMessage?: string|((error: Error) => string);
  successMessage?: string|((output: string) => string);
}

export interface TaskObjectInternal {
  command: string;
  errorMessage: (error: Error) => string;
  successMessage: (output: string) => string;
}

export function isTaskObject(task: string|TaskObject): task is TaskObject {
  return typeof task === 'object';
}

export function createTaskObject(task: string|TaskObject): TaskObjectInternal {
  const taskCommand = isTaskObject(task) ? task.command : task;
  const errorMessage = isTaskObject(task) ? task.errorMessage : '';
  const successMessage = isTaskObject(task) ? task.successMessage : '';

  return {
    command: taskCommand,

    errorMessage: getMessage<(error: Error) => string>(
        errorMessage, DEFAULT_ERROR_MESSAGE(taskCommand)),

    successMessage: getMessage<(output: string) => string>(
        successMessage, DEFAULT_SUCCESS_MESSAGE(taskCommand)),

  };
}
