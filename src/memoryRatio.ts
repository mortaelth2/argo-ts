import { Resources } from "./k8sTypes";

export type MemoryUnit = "Gi" | "Mi";

export function gbToGib(memoryGb: number): number {
    return memoryGb * 0.9313225746154785;
}

export function mbToMib(memoryMb: number): number {
    return memoryMb * 0.95367431640625;
}

/**
 *
 * @param memorySize Integer number
 * @param unit "Gi" or "Mi"
 * @returns Kubernetes resources object. CPU requests are automatically calculated from 'memorySize'
 */
export function memoryRatio(memorySize: number, unit: MemoryUnit): Resources {
    validateMemorySize(memorySize);
    const memorySizeMi = unit === "Mi" ? memorySize : memorySize * 1024;

    const cpuSize = Math.floor(((memorySizeMi / 1024) * 1000) / 8);
    return {
        limits_memory: `${memorySize}${unit}`,
        requests_cpu: `${cpuSize}m`,
        requests_memory: `${memorySize}${unit}`,
    };
}
/**
 *
 * @param memorySize Integer number
 * @param maxMemorySize Integer number bigger then 'memorySize'
 * @param unit "Gi" or "Mi"
 * @returns Kubernetes resources object. CPU requests are automatically calculated from 'memorySize'
 */
export function memoryRatioWithLimitOverride(memorySize: number, maxMemorySize: number, unit: MemoryUnit): Resources {
    validateMemorySize(memorySize, maxMemorySize);
    const memorySizeMi = unit === "Mi" ? memorySize : memorySize * 1024;

    const cpuSize = Math.floor(((memorySizeMi / 1024) * 1000) / 8);
    return {
        limits_memory: `${maxMemorySize}${unit}`,
        requests_cpu: `${cpuSize}m`,
        requests_memory: `${memorySize}${unit}`,
    };
}
/**
 *
 * @param memory string representing memory. e.g. "2Gi" or requestsMemory and limitMemory divided by ";", e.g. "2Gi;3Gi"
 * @returns Kubernetes resources object. CPU requests are automatically calculated from 'memory'
 */
export function memoryRatioFromString(memory: string): Resources {
    const splitted = memory.split(";");
    if (splitted.length === 2) {
        const requests = parseMemoryRatio(splitted[0]);
        const limits = parseMemoryRatio(splitted[1]);
        if (requests.unit === limits.unit) {
            return memoryRatioWithLimitOverride(requests.size, limits.size, requests.unit);
        } else if (requests.unit === "Gi") {
            return memoryRatioWithLimitOverride(requests.size * 1024, limits.size, limits.unit);
        } else {
            return memoryRatioWithLimitOverride(requests.size, limits.size * 1024, requests.unit);
        }
    } else if (splitted.length === 1) {
        const { size, unit } = parseMemoryRatio(memory);
        return memoryRatio(size, unit);
    } else {
        throw new Error(`Wrong input provided: ${memory}`);
    }
}

function validateMemorySize(memorySize: number, maxMemorySize?: number) {
    if (memorySize <= 0 || (maxMemorySize !== undefined && maxMemorySize < memorySize)) {
        throw new Error(
            `MemorySize must be positive. MaxMemory size must be greater then MemorySize. Received: memorySize: ${memorySize}, maxMemorySize: ${maxMemorySize}`,
        );
    }
    if (!isInt(memorySize) || (maxMemorySize !== undefined && !isInt(maxMemorySize))) {
        throw new Error(
            `memorySize and maxMemorySize must be whole numbers (integers). Received: memorySize: ${memorySize}, maxMemorySize: ${maxMemorySize}`,
        );
    }
}

function parseMemoryRatio(memory: string): { size: number; unit: MemoryUnit } {
    const unit = memory.slice(-2);
    if (unit !== "Gi" && unit !== "Mi") {
        throw new Error(`Unable to parse memoryRatioFromString("${memory}"). Only "Gi", "Mi" units supported.`);
    }
    const sizeString = memory.substr(0, memory.length - 2);
    const size = parseFloat(sizeString);
    if (Number.isNaN(size)) {
        throw new Error(`Unable to parse memoryRatioFromString("${memory}")`);
    }

    return { size, unit };
}

function isInt(x: number): boolean {
    return Number.isInteger(x);
}
