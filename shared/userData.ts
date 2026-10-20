import { z } from "zod";

/** Only this non-sensitive namespace may be synchronized with an authenticated account. */
export const USER_DATA_KEY_PREFIX = "madini-";
export const MAX_USER_DATA_KEYS = 32;
export const MAX_USER_DATA_BYTES = 128 * 1024;
export const MAX_USER_DATA_DEPTH = 4;

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type UserDataMap = Record<string, JsonValue>;

const allowedKeyPattern = /^madini-[a-z0-9][a-z0-9-]{0,63}$/;
const prohibitedKeyPattern = /(secret|token|password|authorization|cookie|session|api-?key)/i;

export function isSafeUserDataKey(key: string): boolean {
  return allowedKeyPattern.test(key) && !prohibitedKeyPattern.test(key);
}

function validateJsonValue(value: unknown, depth: number, path: (string | number)[]): string | null {
  if (value === null || typeof value === "boolean") return null;
  if (typeof value === "string") return value.length <= 16_384 ? null : "النص أطول من الحد المسموح";
  if (typeof value === "number") return Number.isFinite(value) ? null : "الأرقام يجب أن تكون محدودة";
  if (depth > MAX_USER_DATA_DEPTH) return "البيانات متداخلة أكثر من الحد المسموح";

  if (Array.isArray(value)) {
    if (value.length > 128) return "القائمة أطول من الحد المسموح";
    for (let index = 0; index < value.length; index += 1) {
      const problem = validateJsonValue(value[index], depth + 1, [...path, index]);
      if (problem) return problem;
    }
    return null;
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length > 64) return "الكائن يحتوي مفاتيح أكثر من الحد المسموح";
    for (const [key, nested] of entries) {
      // A token must never be hidden inside a JSON value even when its top-level
      // storage key is otherwise valid.
      if (prohibitedKeyPattern.test(key)) return `الحقل ${[...path, key].join(".")} غير مسموح`;
      const problem = validateJsonValue(nested, depth + 1, [...path, key]);
      if (problem) return problem;
    }
    return null;
  }

  return "القيمة يجب أن تكون JSON صالحًا";
}

export const userDataMapSchema = z.record(z.string(), z.unknown()).superRefine((data, ctx) => {
  const entries = Object.entries(data);
  if (entries.length > MAX_USER_DATA_KEYS) {
    ctx.addIssue({ code: "custom", message: `يمكن حفظ ${MAX_USER_DATA_KEYS} مفتاحًا كحد أقصى` });
  }

  for (const [key, value] of entries) {
    if (!isSafeUserDataKey(key)) {
      ctx.addIssue({
        code: "custom",
        path: [key],
        message: "المفتاح يجب أن يبدأ بـ madini- ولا يجوز أن يدل على سر أو جلسة أو رمز متصفح",
      });
      continue;
    }
    const problem = validateJsonValue(value, 0, [key]);
    if (problem) ctx.addIssue({ code: "custom", path: [key], message: problem });
  }

  let serialized = "";
  try {
    serialized = JSON.stringify(data);
  } catch {
    ctx.addIssue({ code: "custom", message: "تعذر تحويل البيانات إلى JSON" });
    return;
  }
  if (new TextEncoder().encode(serialized).byteLength > MAX_USER_DATA_BYTES) {
    ctx.addIssue({ code: "custom", message: "حجم البيانات أكبر من الحد المسموح" });
  }
}).transform(data => data as UserDataMap);

export const userDataSaveInputSchema = z.object({
  data: userDataMapSchema,
  // Optimistic concurrency marker. null means the client observed no server row.
  expectedUpdatedAt: z.string().datetime({ offset: true }).nullable(),
});

export type UserDataSaveInput = z.infer<typeof userDataSaveInputSchema>;
