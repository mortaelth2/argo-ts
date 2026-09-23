import { App, Names } from "cdk8s";
import * as fs from "fs";
import * as path from "path";
import _ = require("lodash");

/**
 * Manifest file base name for a component path, e.g. "root/builder/app" -> "root-builder-app".
 * Shared by the renamer and the lookup so the two can never disagree.
 */
export function componentFileBaseName(componentPath: string): string {
    return componentPath.replace(/\//g, "-").toLowerCase();
}

export class SynthesisFileManager {
    /**
     * Renames synthesized files to follow a consistent naming convention.
     *
     * Converts files from format: "0001-root-builder-app-abc12345.k8s.yaml"
     * To format: "root-builder-app.k8s.yaml" (the chart's full construct path)
     */
    static renameSynthFiles(app: App): void {
        const outputDir = app.outdir;

        if (!FileUtils.isValidDirectory(outputDir)) {
            console.warn(`Output directory not found or invalid: ${outputDir}`);
            return;
        }

        // cdk8s names chart files with Names.toDnsLabel, which caps the name at 63 chars by cutting
        // the leading path components. Parsing that name back can't recover the full path the lookup
        // expects, so map each cdk8s label to its chart's path instead.
        const pathByLabel = new Map(app.charts.map((chart) => [Names.toDnsLabel(chart), chart.node.path]));
        const files = fs.readdirSync(outputDir);

        for (const file of files) {
            try {
                const match = file.match(/^(?:\d+-)?(.*)\.k8s\.yaml$/i);
                const chartPath = match ? pathByLabel.get(match[1]) : undefined;
                const newName = chartPath
                    ? `${componentFileBaseName(chartPath)}.k8s.yaml`
                    : SynthesisFileManager.generateCleanFileName(file);
                if (newName && newName !== file) {
                    SynthesisFileManager.renameFile(outputDir, file, newName);
                }
            } catch (error) {
                console.error(`Failed to rename ${file}:`, error);
            }
        }
    }

    /**
     * Generates a clean filename from the CDK8s synthesis output.
     */
    static generateCleanFileName(originalName: string): string | null {
        const pattern = /^\d+-(.*?)(?:-[a-z0-9]{8})?\.k8s\.yaml$/i;
        const match = originalName.match(pattern);

        if (!match) {
            throw new Error(`File name does not match expected pattern: ${originalName}`);
        }

        const baseName = match[1];
        return `${baseName}.k8s.yaml`;
    }

    /**
     * Safely renames a file, handling conflicts by removing existing files.
     */
    static renameFile(dir: string, from: string, to: string): void {
        const fromPath = path.join(dir, from);
        const toPath = path.join(dir, to);

        if (fs.existsSync(toPath)) {
            fs.unlinkSync(toPath);
        }

        fs.renameSync(fromPath, toPath);
    }
}

export class ComponentOutputManager {
    /**
     * Prints the component manifest to stdout for ArgoCD consumption.
     *
     * This function is called by the ArgoCD ConfigManagementPlugin to get
     * the Kubernetes manifests for a specific component.
     */
    static printComponentToStdout(rootComponent: string): void {
        const componentName = ComponentOutputManager.getTargetComponent(rootComponent);
        console.error(`#--- Outputting component manifest for: ${componentName} ---`);

        try {
            const manifestContent = ComponentOutputManager.readComponentManifest(componentName);
            process.stdout.write(manifestContent);
        } catch (error) {
            console.error("Error reading component manifest:", error);
            process.exit(1);
        }
    }

    /**
     * Gets the target component from environment variable.
     */
    static getTargetComponent(rootComponent: string): string {
        const componentEnv = process.env.ARGOCD_ENV_component?.trim();

        if (!componentEnv) {
            console.error("#--- No component env var set, defaulting to the root component ---");
            return rootComponent;
        }

        return componentFileBaseName(componentEnv);
    }

    /**
     * Reads the manifest file for a specific component.
     */
    static readComponentManifest(componentName: string): string {
        const distDir = path.resolve(process.cwd(), "dist");

        if (!FileUtils.isValidDirectory(distDir)) {
            throw new Error(`Distribution directory not found: ${distDir}`);
        }

        const manifestFile = ComponentOutputManager.findManifestFile(distDir, componentName);
        const manifestPath = path.join(distDir, manifestFile);

        console.error(`#---  from file: ${manifestPath} ---\n`);
        return fs.readFileSync(manifestPath, "utf8");
    }

    /**
     * Finds the manifest file for a component in the distribution directory.
     */
    static findManifestFile(distDir: string, componentName: string): string {
        const files = fs.readdirSync(distDir);
        const manifestFile = files.find((file) => file === componentName || file === `${componentName}.k8s.yaml`);

        if (!manifestFile) {
            throw new Error(`No file in dist matching component name: ${componentName}\n` + `Available files: ${files.join(", ")}`);
        }

        return manifestFile;
    }
}

export class DebugUtils {}

class FileUtils {
    static isValidDirectory(dirPath: string): boolean {
        try {
            return fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory();
        } catch {
            return false;
        }
    }
}

/**
 * Utility class for handling component filtering logic.
 */
export class ComponentFilter {
    /**
     * Determines if a component should be included in the build based on the target filter.
     *
     * @param componentPath - The full path of the component (e.g., "core/commonBuilder/observability")
     * @param targetFilter - The target component filter from environment variable
     * @returns true if component should be included, false otherwise
     *
     * @example
     * ComponentFilter.shouldInclude("core/commonBuilder/observability", "core") // => true
     * ComponentFilter.shouldInclude("core/commonBuilder", "core/commonBuilder/observability") // => true
     * ComponentFilter.shouldInclude("core/otherBuilder", "core/commonBuilder") // => false
     */
    static shouldInclude(componentPath: string, targetFilter?: string): boolean {
        // If no filter is specified, include all components
        if (!targetFilter?.trim()) {
            return true;
        }

        const trimmedFilter = targetFilter.trim();

        // Exact match
        if (componentPath === trimmedFilter) {
            return true;
        }

        // Component path is a parent of the target filter
        if (trimmedFilter.startsWith(componentPath + "/")) {
            return true;
        }

        return false;
    }
}
