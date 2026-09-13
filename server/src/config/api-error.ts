// Messages in French on purpose: they are the contract's, verbatim
// (docs/api-design.md). The rest of the codebase stays English.
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}
