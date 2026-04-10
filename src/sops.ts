import { execSync } from "child_process";
import * as path from "path";
import { deepObfuscate } from "./deepObfuscate";
import { decodeGlobalSecrets } from "./secretsDecode";
import { mergeAndUnsetNulls } from "./mergeAndUnsetNulls";

export interface SopsOptions {
    /** Obfuscate secret values for safe logging. Defaults to true unless OBFUSCATE_SECRETS=false. */
    obfuscate?: boolean;
    /** Decode base64-encoded string values. Defaults to true. */
    decode?: boolean;
}

const secretsCache = new Map<string, any>();

export function clearSecretsCache(): void {
    secretsCache.clear();
}

function decryptFile<T extends Record<string, any>>(resolvedPath: string): T {
    const decrypted = execSync(`sops -d "${resolvedPath}"`, { encoding: "utf8" });
    return JSON.parse(decrypted);
}

/**
 * Decrypt a SOPS-encrypted JSON file with optional base64 decoding and obfuscation.
 * Results are cached by resolved absolute path.
 *
 * @param filePath - Path to the SOPS-encrypted file (absolute or relative to cwd)
 * @param options - Optional decode/obfuscate flags
 */
export function readSopsFile<T extends Record<string, any>>(filePath: string, options?: SopsOptions): T {
    const resolvedPath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
    const shouldObfuscate = options?.obfuscate ?? (process.env.OBFUSCATE_SECRETS === undefined || process.env.OBFUSCATE_SECRETS !== "false");
    const shouldDecode = options?.decode ?? true;

    if (secretsCache.has(resolvedPath)) {
        return secretsCache.get(resolvedPath)! as T;
    }

    try {
        let data: any = decryptFile<T>(resolvedPath);

        if (shouldDecode) {
            data = decodeGlobalSecrets(data);
        }
        if (shouldObfuscate) {
            data = deepObfuscate(data);
        }

        secretsCache.set(resolvedPath, data);
        return data as T;
    } catch (err) {
        throw new Error(`Failed to load secrets from ${resolvedPath}: ${(err as Error).message}`);
    }
}

/**
 * Load and merge two SOPS-encrypted JSON files (e.g. global + local secrets).
 * The local file values override global file values.
 *
 * @param globalPath - Path to the global secrets file
 * @param localPath - Path to the local secrets file
 * @param options - Optional decode/obfuscate flags
 */
export function loadAndMergeSecrets<T extends Record<string, any>>(globalPath: string, localPath: string, options?: SopsOptions): T {
    const global = readSopsFile<any>(globalPath, options);
    const local = readSopsFile<any>(localPath, options);
    return mergeAndUnsetNulls(global, local) as T;
}
