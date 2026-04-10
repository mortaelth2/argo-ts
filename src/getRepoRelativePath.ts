import * as path from "path";
/**
 * Get the relative path from a directory to the root of the git repository.
 * @param fromDir The directory to get the relative path from.
 * @param rootRepoDir The root directory of the git repository.
 * @returns The relative path from the specified directory to the root of the git repository.
 */
export function getRepoRelativePath(fromDir: string, rootRepoDir: string): string {
    const parts = fromDir.split(path.sep);
    const idx = parts.lastIndexOf(rootRepoDir);
    if (idx === -1) throw new Error(`Folder "${rootRepoDir}" not found in path: ${fromDir}`);
    return parts.slice(idx).join(path.sep);
}
