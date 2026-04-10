/**
 * Converts a string to base64 encoding (similar to browser's btoa)
 * @param str - The string to encode
 * @returns Base64 encoded string
 */
export function stringToBase64(str: string): string {
    return Buffer.from(str, "utf8").toString("base64");
}

/**
 * Converts a base64 encoded string back to a regular string (similar to browser's atob)
 * @param base64 - The base64 encoded string to decode
 * @returns Decoded string
 */
export function base64ToString(base64: string): string {
    return Buffer.from(base64, "base64").toString("utf8");
}

/**
 * Alias for stringToBase64 to match browser's btoa function name
 * @param str - The string to encode
 * @returns Base64 encoded string
 */
export const btoa = stringToBase64;

/**
 * Alias for base64ToString to match browser's atob function name
 * @param base64 - The base64 encoded string to decode
 * @returns Decoded string
 */
export const atob = base64ToString;
