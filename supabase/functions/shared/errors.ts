export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 500,
    public retryable = false,
    public details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'AppError'
  }
}
