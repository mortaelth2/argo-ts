import { Resources } from "./k8sTypes";

export function convertToK8sResources(resources: Resources) {
    return {
        requests: {
            cpu: resources.requests_cpu,
            memory: resources.requests_memory,
        },
        limits: {
            // https://medium.com/@mikeh91/conditionally-adding-keys-to-javascript-objects-using-spread-operators-and-short-circuit-evaluation-acf157488ede
            ...(resources.limits_cpu && {
                cpu: resources.limits_cpu,
            }),
            ...(resources.limits_memory && {
                memory: resources.limits_memory,
            }),
        },
    };
}
