export function deepObfuscate(x: any): any {
    if (x === null || x === undefined) {
        return x;
    }
    if (typeof x === "object") {
        const result: { [key: string]: any } = {};
        for (const prop in x) {
            result[prop] = deepObfuscate(x[prop]);
        }
        return result;
    }
    if (typeof x === "string") {
        return obfuscateString(x);
    }
    return x;
}

function obfuscateString(x: string): string {
    return `l(${x.length}):${x.replace(/\s/g, "").substring(0, 3)}***`;
}
