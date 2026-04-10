/**
 * Recursively decodes base64-encoded string values in an object.
 * Non-base64 strings and non-string values are left unchanged.
 */
export function decodeGlobalSecrets<T extends Record<string, any>>(object: T): T {
    const result: Partial<T> = {};

    for (const [key, value] of Object.entries(object)) {
        if (typeof value === "object" && value !== null) {
            // Recursively decode nested objects
            result[key as keyof T] = decodeGlobalSecrets(value) as any;
        } else if (typeof value === "string" && isBase64(value)) {
            // Decode if it's a Base64String
            result[key as keyof T] = Buffer.from(value, "base64").toString("utf-8") as any;
        } else {
            // Keep other values as is
            result[key as keyof T] = value as any;
        }
    }

    return result as T;
}

/**
 * Checks if a string is valid base64-encoded content.
 * Performs strict validation: length must be a multiple of 4,
 * only valid base64 characters, and re-encoding must match the original.
 */
export function isBase64(s: string): boolean {
    if (typeof s !== "string") return false;

    // Must be a multiple of 4 and only contain valid Base64 characters
    const notBase64 = /[^A-Za-z0-9+/=]/;
    if (s.length % 4 !== 0 || notBase64.test(s)) return false;

    try {
        const decoded = Buffer.from(s, "base64").toString("utf-8");

        // Re-encode and compare to original (strict check)
        const reEncoded = Buffer.from(decoded, "utf-8").toString("base64");
        return reEncoded === s;
    } catch {
        return false;
    }
}
