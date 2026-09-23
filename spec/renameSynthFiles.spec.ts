import { App, Chart } from "cdk8s";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { SynthesisFileManager } from "../src/bootstrap";

describe("SynthesisFileManager.renameSynthFiles", () => {
    let outdir: string;

    beforeEach(() => {
        outdir = fs.mkdtempSync(path.join(os.tmpdir(), "argots-synth-"));
    });

    afterEach(() => {
        fs.rmSync(outdir, { recursive: true, force: true });
    });

    const synth = (build: (root: Chart) => void): string[] => {
        const app = new App({ outdir });
        const root = new Chart(app, "imAppBuilder");
        build(root);
        app.synth();
        SynthesisFileManager.renameSynthFiles(app);
        return fs.readdirSync(outdir).sort();
    };

    it("names files after the chart's full construct path", () => {
        const files = synth((root) => new Chart(new Chart(root, "instances"), "pim-ahlsell-qa"));
        expect(files).toEqual([
            "imappbuilder-instances-pim-ahlsell-qa.k8s.yaml",
            "imappbuilder-instances.k8s.yaml",
            "imappbuilder.k8s.yaml",
        ]);
    });

    it("keeps the full path when cdk8s truncates the label past 63 chars", () => {
        const id = "pim-customer-longname-2026abcdefg-dev";
        const files = synth((root) => new Chart(new Chart(root, "instances"), id));
        expect(files).toContain(`imappbuilder-instances-${id}.k8s.yaml`);
    });
});
