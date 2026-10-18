export default class TruncatedMessageError extends Error {
  constructor() {
    super('The message ended before all fields were read. It may be truncated.');
    this.name = 'TruncatedMessageError';
  }
}
