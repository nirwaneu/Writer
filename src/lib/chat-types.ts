export type ChatFailure = {
  message: string;
  retryable: boolean;
  saved: boolean;
} | null;
