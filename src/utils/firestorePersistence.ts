const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

/**
 * Creates a Firestore-safe snapshot without changing the in-memory report.
 *
 * Firestore rejects undefined values by default. Report validation may
 * legitimately leave optional, unavailable fields as undefined, so the
 * persistence boundary removes only undefined object properties. Undefined
 * array slots become null to preserve array positions. All other values are
 * preserved exactly; this function never invents or coerces financial data.
 */
export const sanitizeUndefinedForPersistence = <T>(value: T): T => {
  const sanitize = (current: unknown, inArray = false): unknown => {
    if (current === undefined) return inArray ? null : undefined;

    if (Array.isArray(current)) {
      return current.map(item => sanitize(item, true));
    }

    if (isPlainObject(current)) {
      const sanitized: Record<string, unknown> = {};
      for (const [key, item] of Object.entries(current)) {
        if (item === undefined) continue;
        sanitized[key] = sanitize(item, false);
      }
      return sanitized;
    }

    return current;
  };

  return sanitize(value, false) as T;
};

/**
 * Soft-deleted report snapshots remain in Firestore for recovery/auditability.
 * Legacy reports do not have deletedAt and therefore remain visible.
 */
export const isSoftDeletedReportRecord = (value: unknown): boolean => {
  if (!isPlainObject(value)) return false;
  return value.deletedAt !== undefined && value.deletedAt !== null;
};
