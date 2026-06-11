import { ArgoBootstrapApp, DefaultArgoConfig } from "../src/argoApp";

/**
 * buildApplicationSpec is private static; it only reads plain properties off its
 * two arguments, so we exercise it with minimal fakes via a cast rather than
 * standing up a full cdk8s construct tree.
 */
function buildSpec(childArgoAppSpec: any): any {
    const childApp: any = {
        node: { path: "apps/imApp/example" },
        namespace: "example-dev",
        props: { additionalSources: undefined },
        argoAppSpec: childArgoAppSpec,
    };
    const config: any = {
        gitConfig: { gitRepoUrl: "https://example/repo.git", path: ".", gitRepoRevision: "master" },
        namespace: "example-dev",
        project: "pfx-im",
        defaultSyncPolicy: DefaultArgoConfig.enhancedSyncPolicy(true),
        additionalSources: undefined,
    };
    return (ArgoBootstrapApp as any).buildApplicationSpec(childApp, config);
}

describe("buildApplicationSpec syncOptions handling", () => {
    it("replaces (not index-merges) child syncOptions, dropping the default ServerSideApply tail", () => {
        // Regression: lodash _.merge overlays arrays by index, so a child array
        // shorter than enhancedSyncPolicy's 4 entries used to leak the default
        // tail (e.g. a stray ServerSideApply=true) and misalign the rest.
        const spec = buildSpec({ syncPolicy: { syncOptions: ["CreateNamespace=true", "PruneLast=true"] } });
        expect(spec.syncPolicy.syncOptions).toEqual(["CreateNamespace=true", "PruneLast=true"]);
        expect(spec.syncPolicy.syncOptions).not.toContain("ServerSideApply=true");
    });

    it("takes child syncOptions verbatim when ServerSideApply is requested", () => {
        const spec = buildSpec({
            syncPolicy: { syncOptions: ["CreateNamespace=true", "PruneLast=true", "ServerSideApply=true"] },
        });
        expect(spec.syncPolicy.syncOptions).toEqual(["CreateNamespace=true", "PruneLast=true", "ServerSideApply=true"]);
    });

    it("dedupes child syncOptions", () => {
        const spec = buildSpec({ syncPolicy: { syncOptions: ["CreateNamespace=true", "PruneLast=true", "PruneLast=true"] } });
        expect(spec.syncPolicy.syncOptions).toEqual(["CreateNamespace=true", "PruneLast=true"]);
    });

    it("keeps the enhanced default when the child specifies no syncOptions", () => {
        const spec = buildSpec({});
        expect(spec.syncPolicy.syncOptions).toEqual([
            "CreateNamespace=true",
            "ApplyOutOfSyncOnly=true",
            "PruneLast=true",
            "ServerSideApply=true",
        ]);
    });
});
