import { ArgoBootstrapApp, DefaultArgoConfig } from "../src/argoApp";

/** Same minimal-fake approach as syncOptions.spec.ts: buildApplicationSpec only reads plain properties. */
function buildSpec(childAutoSync: boolean | undefined, parentAutoSync: boolean): any {
    const childApp: any = {
        node: { path: "root/builder/app" },
        namespace: "app",
        props: { additionalSources: undefined, autoSyncEnabled: childAutoSync },
        argoAppSpec: undefined,
    };
    const config: any = {
        gitConfig: { gitRepoUrl: "https://example/repo.git", path: ".", gitRepoRevision: "master" },
        project: "default",
        defaultSyncPolicy: DefaultArgoConfig.enhancedSyncPolicy(parentAutoSync),
    };
    return (ArgoBootstrapApp as any).buildApplicationSpec(childApp, config);
}

describe("buildApplicationSpec child autoSyncEnabled", () => {
    it("disables automated sync on the child's own Application when the parent has it on", () => {
        const spec = buildSpec(false, true);
        expect(spec.syncPolicy.automated).toBeUndefined();
        expect(spec.syncPolicy.syncOptions).toEqual(DefaultArgoConfig.enhancedSyncPolicy(true).syncOptions);
    });

    it("enables automated sync on the child's own Application when the parent has it off", () => {
        expect(buildSpec(true, false).syncPolicy.automated).toEqual({ prune: true, selfHeal: true, allowEmpty: true });
    });

    it("inherits the parent's policy when the child sets nothing", () => {
        expect(buildSpec(undefined, true).syncPolicy.automated).toBeDefined();
        expect(buildSpec(undefined, false).syncPolicy.automated).toBeUndefined();
    });

    it("still lets argoAppSpec.syncPolicy.automated override", () => {
        const childApp: any = {
            node: { path: "root/builder/app" },
            props: { autoSyncEnabled: false },
            argoAppSpec: { syncPolicy: { automated: { prune: false, selfHeal: true } } },
        };
        const config: any = {
            gitConfig: { gitRepoUrl: "https://example/repo.git", path: "." },
            defaultSyncPolicy: DefaultArgoConfig.enhancedSyncPolicy(true),
        };
        const spec = (ArgoBootstrapApp as any).buildApplicationSpec(childApp, config);
        expect(spec.syncPolicy.automated).toEqual({ prune: false, selfHeal: true });
    });
});
