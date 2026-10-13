import { App, Chart } from "cdk8s";
import { ArgoApplication, ArgoBootstrapApp, ArgoBootstrapAppProps } from "../src/argoApp";

const gitConfig = { gitRepoUrl: "https://example/repo.git", path: ".", gitRepoRevision: "main" };

class Leaf extends ArgoBootstrapApp {
    protected build(): void {}
}

/** Bootstraps a root with one child and returns the Application generated for it. */
function childApplication(childProps: Partial<ArgoBootstrapAppProps>): any {
    const root = new Chart(new App(), "root");
    new Leaf(root, "child", { gitConfig, namespace: "child-ns", ...childProps }, {});
    ArgoBootstrapApp.bootstrap(root, gitConfig, true, undefined, undefined, "default");
    return root.toJson().find((o: any) => o.kind === "Application");
}

describe("child Application metadata", () => {
    it("keeps the defaults when the child sets nothing", () => {
        const app = childApplication({});
        expect(app.metadata.annotations).toEqual({ "argocd.argoproj.io/manifest-generate-paths": "." });
        expect(app.metadata.finalizers).toEqual(["resources-finalizer.argocd.argoproj.io"]);
        expect(app.metadata.labels).toBeUndefined();
    });

    it("applies the child's annotations over the defaults, and its labels", () => {
        const app = childApplication({
            argoAppMetadata: {
                annotations: { "argocd.argoproj.io/manifest-generate-paths": "/child-ns;/index.ts", "x/y": "z" },
                labels: { "cluster-type": "core" },
            },
        });
        expect(app.metadata.annotations).toEqual({ "argocd.argoproj.io/manifest-generate-paths": "/child-ns;/index.ts", "x/y": "z" });
        expect(app.metadata.labels).toEqual({ "cluster-type": "core" });
    });

    it("leaves out the resources finalizer when asked, keeping any others", () => {
        expect(childApplication({ argoAppMetadata: { resourcesFinalizer: false } }).metadata.finalizers).toBeUndefined();
        const app = childApplication({ argoAppMetadata: { resourcesFinalizer: false, finalizers: ["example.com/keep"] } });
        expect(app.metadata.finalizers).toEqual(["example.com/keep"]);
    });
});

describe("ArgoApplication", () => {
    it("still adds the resources finalizer by default", () => {
        const chart = new Chart(new App(), "c");
        new ArgoApplication(chart, "a", { applicationName: "a", spec: {} });
        expect(chart.toJson()[0].metadata.finalizers).toEqual(["resources-finalizer.argocd.argoproj.io"]);
    });
});
