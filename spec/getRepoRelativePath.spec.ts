import { getRepoRelativePath } from "../src/getRepoRelativePath";

describe("getRepoRelativePath", () => {
    const original = process.env.ARGOCD_APP_SOURCE_PATH;

    afterEach(() => {
        if (original === undefined) delete process.env.ARGOCD_APP_SOURCE_PATH;
        else process.env.ARGOCD_APP_SOURCE_PATH = original;
    });

    it("slices the path from the last occurrence of the repo root folder", () => {
        delete process.env.ARGOCD_APP_SOURCE_PATH;
        expect(getRepoRelativePath("/home/me/git/k8s-clusters/envs/gcp/core/core-geng-1", "envs")).toBe("envs/gcp/core/core-geng-1");
    });

    it("throws when the repo root folder is absent and no build env is set", () => {
        delete process.env.ARGOCD_APP_SOURCE_PATH;
        expect(() => getRepoRelativePath("/tmp/_cmp_server/f14e95f9", "envs")).toThrow(/Folder "envs" not found/);
    });

    it("prefers ARGOCD_APP_SOURCE_PATH when ArgoCD roots the CMP tarball at the app dir", () => {
        process.env.ARGOCD_APP_SOURCE_PATH = "envs/gcp/core/core-geng-1";
        expect(getRepoRelativePath("/tmp/_cmp_server/f14e95f9", "envs")).toBe("envs/gcp/core/core-geng-1");
    });

    it("normalises leading and trailing separators from the build env", () => {
        process.env.ARGOCD_APP_SOURCE_PATH = "./envs/gcp/core/core-geng-1/";
        expect(getRepoRelativePath("/tmp/_cmp_server/f14e95f9", "envs")).toBe("envs/gcp/core/core-geng-1");
    });
});
