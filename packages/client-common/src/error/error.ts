const errorRe =
  /(Code|Error): (?<code>\d+).*Exception: (?<message>.+)\((?<type>(?=.+[A-Z]{3})[A-Z0-9_]+?)\)/s

interface ParsedClickHouseError {
  message: string
  code: string
  type?: string
}

/** An error that is thrown by the ClickHouse server. */
export class ClickHouseError extends Error {
  readonly code: string
  readonly type: string | undefined
  constructor({ message, code, type }: ParsedClickHouseError) {
    super(message)
    this.code = code
    this.type = type

    // Set the prototype explicitly, see:
    // https://github.com/Microsoft/TypeScript/wiki/Breaking-Changes#extending-built-ins-like-error-array-and-map-may-no-longer-work
    Object.setPrototypeOf(this, ClickHouseError.prototype)
  }
}

export function parseError(input: string | Error): ClickHouseError | Error {
  const inputIsError = input instanceof Error
  const message = inputIsError ? input.message : input
  const match = message.match(errorRe)
  const groups = match?.groups as ParsedClickHouseError | undefined
  if (groups) {
    return new ClickHouseError(groups)
  } else {
    return inputIsError ? input : new Error(input)
  }
}

/** Captures the current stack trace from the sync context before going async.
 *  It is necessary since the majority of the stack trace is lost when an async callback is called. */
export function getCurrentStackTrace(): string {
  const stack = new Error().stack
  if (!stack) return ''

  // Skip the first three lines of the stack trace, containing useless information
  // - Text `Error`
  // - Info about this function call
  // - Info about the originator of this function call, e.g., `request`
  // Additionally, the original stack trace is, in fact, reversed.
  return stack.split('\n').slice(3).reverse().join('\n')
}

/** Having the stack trace produced by the {@link getCurrentStackTrace} function,
 *  add it to an arbitrary error stack trace. No-op if there is no additional stack trace to add.
 *  It could happen if this feature was disabled due to its performance overhead. */
export function enhanceStackTrace<E extends Error>(
  err: E,
  stackTrace: string | undefined,
): E {
  if (err.stack && stackTrace) {
    const firstNewlineIndex = err.stack.indexOf('\n')
    const firstLine = err.stack.substring(0, firstNewlineIndex)
    const errStack = err.stack.substring(firstNewlineIndex + 1)
    err.stack = `${firstLine}\n${stackTrace}\n${errStack}`
  }
  return err
}
