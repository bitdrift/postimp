type LogLevel = "info" | "warn" | "error";

type LogPayload = {
  operation: string;
  message: string;
  [key: string]: unknown;
};

const REDACT_PATTERN = /token|secret|password|authorization|api_?key/i;

function redact(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (REDACT_PATTERN.test(k)) {
      result[k] = "[REDACTED]";
    } else if (v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Error)) {
      result[k] = redact(v as Record<string, unknown>);
    } else {
      result[k] = v;
    }
  }
  return result;
}

function serializeError(err: unknown): { name: string; message: string; stack?: string } {
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: err.stack };
  }
  return { name: "UnknownError", message: String(err) };
}

function emit(level: LogLevel, payload: LogPayload): void {
  const entry = redact({
    timestamp: new Date().toISOString(),
    level,
    ...payload,
  });
  const line = JSON.stringify(entry);
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

function timed(): () => number {
  const start = performance.now();
  return () => Math.round(performance.now() - start);
}

function maskPhone(phone: string): string {
  return phone.length >= 4 ? `***${phone.slice(-4)}` : "***";
}

export const log = {
  info: (payload: LogPayload) => emit("info", payload),
  warn: (payload: LogPayload) => emit("warn", payload),
  error: (payload: LogPayload) => emit("error", payload),
};

export { timed, serializeError, maskPhone, redact };
