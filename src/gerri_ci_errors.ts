export class ConfigurationError extends Error {
  constructor(message: string) {
    super(`[Configuration Error] ${message}`);
  }
}

export class ExtractionError extends Error {
  constructor(message: string) {
    super(`[Extraction Error] ${message}`);
  }
}
