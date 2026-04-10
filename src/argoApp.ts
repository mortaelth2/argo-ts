import { ApiObject, Chart, ChartProps } from "cdk8s";
import { Construct } from "constructs";
import * as _ from "lodash";
import { ComponentFilter } from "./bootstrap";
import { GitConfig } from "./types";
import {
    Application as CdkApplication,
    ApplicationProps,
    ApplicationSpec,
    ApplicationSpecDestination,
    ApplicationSpecSources,
    ApplicationSpecSyncPolicy,
    ApplicationSet as CdkApplicationSet,
    ApplicationSetProps,
    ApplicationSetSpec,
} from "./types/argocd/argoproj.io";
import { DeepOptional } from "./utilityTypes";

export interface ArgoBootstrapAppProps extends ChartProps {
    gitConfig: GitConfig;
    autoSyncEnabled?: boolean;
    project?: string;
    argoAppSpec?: DeepOptional<ApplicationSpec>;
    additionalSources?: DeepOptional<ApplicationSpecSources>[];
}

export interface BootstrapConfig {
    gitConfig: GitConfig;
    namespace?: string;
    project?: string;
    defaultSyncPolicy?: DeepOptional<ApplicationSpecSyncPolicy>;
    additionalSources?: DeepOptional<ApplicationSpecSources>[];
}

/**
 * Abstract base class for creating Kubernetes resources managed by ArgoCD.
 *
 * This class automatically:
 * - Creates ArgoCD Application manifests for deployment
 * - Handles component-based filtering for selective builds
 * - Provides sensible defaults for ArgoCD configuration
 */
export abstract class ArgoBootstrapApp extends Chart {
    protected readonly gitConfig: GitConfig;
    protected readonly args: any;
    protected readonly props: ArgoBootstrapAppProps;

    constructor(scope: Construct, id: string, props: ArgoBootstrapAppProps, args: any) {
        super(scope, id, props);
        this.gitConfig = props.gitConfig;
        this.args = args;
        this.props = props;

        // Build resources only if this component should be included in the current build
        const shouldBuild = this.shouldBuildComponent();
        if (shouldBuild) {
            this.build();
            ArgoBootstrapApp.bootstrap(
                this,
                this.gitConfig,
                this.resolveAutoSyncEnabled(),
                this.namespace,
                undefined,
                this.resolveProject(),
            );
        }

        // Note: Bootstrap applications are created externally to avoid circular dependencies
        // The bootstrap function should be called on the parent construct after creating children
    } /**
     * Implement this method to define the Kubernetes resources for this component.
     */
    protected abstract build(): void;

    /**
     * Get the ArgoCD Application specification overrides for this component.
     */
    public get argoAppSpec(): DeepOptional<ApplicationSpec> | undefined {
        return this.props.argoAppSpec;
    }

    /**
     * Generate a standardized object name for Kubernetes resources.
     */
    public generateObjectName(apiObject: ApiObject): string {
        return apiObject.metadata?.name ?? apiObject.name;
    }

    /**
     * Resolves autoSyncEnabled by checking this instance's props first,
     * then walking up the construct tree to inherit from the nearest ArgoBootstrapApp ancestor.
     */
    protected resolveAutoSyncEnabled(): boolean {
        if (this.props?.autoSyncEnabled !== undefined) return this.props.autoSyncEnabled;
        let current = this.node.scope;
        while (current) {
            if (current instanceof ArgoBootstrapApp) {
                const parent = current as ArgoBootstrapApp;
                if (parent.props?.autoSyncEnabled !== undefined) return parent.props.autoSyncEnabled;
            }
            current = current.node.scope;
        }
        return true;
    }

    /**
     * Resolves project by checking this instance's props first,
     * then walking up the construct tree to inherit from the nearest ArgoBootstrapApp ancestor.
     * Defaults to "default" if not set anywhere in the tree.
     */
    protected resolveProject(): string {
        if (this.props?.project !== undefined) return this.props.project;
        let current = this.node.scope;
        while (current) {
            if (current instanceof ArgoBootstrapApp) {
                const parent = current as ArgoBootstrapApp;
                if (parent.props?.project !== undefined) return parent.props.project;
            }
            current = current.node.scope;
        }
        return "default";
    }

    /**
     * Determine if this component should be built based on environment filtering.
     */
    private shouldBuildComponent(): boolean {
        const targetComponent = process.env.ARGOCD_ENV_component;
        const shouldInclude = ComponentFilter.shouldInclude(this.node.path, targetComponent);
        // console.error(`#--- Component ${this.node.path}: shouldInclude = ${shouldInclude} (filter: ${targetComponent}) ---`);
        return shouldInclude;
    }

    /**
     * Prints a tree view of the construct hierarchy for debugging.
     *
     * @param construct - Root construct to print
     * @param indent - Indentation prefix for tree formatting
     */
    static printChartTree(construct: Construct, indent: string = "#"): void {
        if (construct instanceof ArgoBootstrapApp) {
            console.error(`${indent}📦 ArgoApp: ${construct.node.id}`);
        } else {
            //console.error(`${indent}🔧 Construct: ${construct.node.id}`);
        }

        // Recursively print children with increased indentation
        for (const child of construct.node.children) {
            ArgoBootstrapApp.printChartTree(child, indent + "  ");
        }
    }

    /**
     * Creates ArgoCD applications for all ArgoBootstrapApp children of a construct.
     *
     * This function automatically discovers child components and generates the corresponding
     * ArgoCD Application manifests with appropriate configuration.
     *
     * @param construct - The parent construct to scan for ArgoBootstrapApp children
     * @param gitConfig - Git repository configuration for ArgoCD source
     * @param namespace - Target namespace for deployment (optional)
     * @param project - ArgoCD project name (defaults to "default")
     * @returns Array of ArgoCD Application API objects
     */
    public static bootstrap(
        construct: Construct,
        gitConfig: GitConfig,
        autoSyncEnabled: boolean,
        namespace?: string,
        additionalSources?: DeepOptional<ApplicationSpecSources>[],
        project?: string,
    ): ApiObject[] {
        const config: BootstrapConfig = {
            gitConfig,
            namespace,
            project: project ?? "default",
            defaultSyncPolicy: DefaultArgoConfig.enhancedSyncPolicy(autoSyncEnabled),
            additionalSources,
        };

        return this.createArgoApplications(construct, config);
    }

    private static createArgoApplications(construct: Construct, config: BootstrapConfig): ApiObject[] {
        const childApps = this.discoverChildApplications(construct);

        return childApps.map((childApp) => {
            const appSpec = this.buildApplicationSpec(childApp, config);

            return new ArgoApplication(construct, `${childApp.node.id}-app`, {
                applicationName: this.generateApplicationName(childApp.node.id),
                spec: appSpec,
            });
        });
    }

    private static discoverChildApplications(construct: Construct): ArgoBootstrapApp[] {
        return construct.node.children.filter((child): child is ArgoBootstrapApp => child instanceof ArgoBootstrapApp);
    }

    private static buildApplicationSpec(childApp: ArgoBootstrapApp, config: BootstrapConfig): DeepOptional<ApplicationSpec> {
        const mainSource = {
            repoUrl: config.gitConfig.gitRepoUrl!,
            path: config.gitConfig.path,
            targetRevision: config.gitConfig.gitRepoRevision ?? "master",
            plugin: {
                name: "argo-ts",
                env: [
                    {
                        name: "component",
                        value: childApp.node.path,
                    },
                ],
            },
        };

        // Check if we should use multi-source (sources array) or single source
        const hasAdditionalSources = config.additionalSources && config.additionalSources.length > 0;
        const childHasAdditionalSources = childApp.props.additionalSources && childApp.props.additionalSources.length > 0;

        const defaultSpec: any = {
            destination: DefaultArgoConfig.destination(config.namespace ?? childApp.namespace ?? "default"),
            project: config.project!,
            syncPolicy: config.defaultSyncPolicy,
        };

        // If additional sources are defined, use multi-source format
        if (hasAdditionalSources || childHasAdditionalSources) {
            const additionalSources = childHasAdditionalSources ? childApp.props.additionalSources! : config.additionalSources!;
            defaultSpec.sources = [mainSource, ...additionalSources];
        } else {
            // Use single source format
            defaultSpec.source = mainSource;
        }

        // Merge with child-specific overrides
        const mergedSpec = _.merge({}, defaultSpec, childApp.argoAppSpec);

        // Special handling for plugin env vars - concatenate instead of replace
        // lodash merge replaces arrays, but we want to keep both component env AND any additional envs
        const childEnvs = childApp.argoAppSpec?.sources?.[0]?.plugin?.env;
        if (mergedSpec.sources?.[0]?.plugin && childEnvs && Array.isArray(childEnvs)) {
            // Multi-source: concatenate env vars (component + additional envs)
            const filteredChildEnvs = childEnvs.filter((e: any): e is { name: string; value: string } => !!e?.name && !!e?.value);
            mergedSpec.sources[0].plugin.env = [...mainSource.plugin.env, ...filteredChildEnvs];
        }

        return mergedSpec;
    }

    private static generateApplicationName(componentId: string): string {
        return componentId.toLowerCase().replace(/[^a-z0-9-]/g, "-");
    }
}

/**
 * Configuration for ArgoCD Application resources.
 */
export interface ArgoApplicationConfig {
    applicationName: string;
    spec: DeepOptional<ApplicationSpec>;
    metadata?: {
        annotations?: Record<string, string>;
        finalizers?: string[];
    };
    autoSyncEnabled?: boolean;
    syncPolicy?: DeepOptional<ApplicationSpecSyncPolicy>;
}

/**
 * Configuration for ArgoCD Application resources.
 */
export interface ArgoApplicationSetConfig {
    applicationName: string;
    spec: DeepOptional<ApplicationSetSpec>;
    metadata?: {
        annotations?: Record<string, string>;
        finalizers?: string[];
    };
}

/**
 * ArgoCD Application resource with improved configuration and defaults.
 */
export class ArgoApplication extends CdkApplication {
    constructor(scope: Construct, id: string, config: ArgoApplicationConfig) {
        const props: DeepOptional<ApplicationProps> = {
            metadata: {
                namespace: "argocd",
                name: config.applicationName,
                annotations: {
                    ...DefaultArgoConfig.annotations(),
                    ...config.metadata?.annotations,
                },
                finalizers: [...(config.metadata?.finalizers ?? []), "resources-finalizer.argocd.argoproj.io"],
            },
            spec: {
                syncPolicy: config.syncPolicy ?? DefaultArgoConfig.syncPolicy(config.autoSyncEnabled),
                ...config.spec,
            },
        };

        super(scope, id, props as ApplicationProps);
    }
}

export class ArgoApplicationSet extends CdkApplicationSet {
    constructor(scope: Construct, id: string, config: ArgoApplicationSetConfig) {
        const metadata = {
            namespace: "argocd",
            name: config.applicationName,
            annotations: {
                ...DefaultArgoConfig.annotations(),
                ...config.metadata?.annotations,
            },
        };
        const props: DeepOptional<ApplicationSetProps> = {
            metadata,
            spec: _.merge({}, { template: { metadata } }, config.spec),
        };

        super(scope, id, props as ApplicationSetProps);
    }
}

/**
 * Default configurations for ArgoCD resources.
 */
export class DefaultArgoConfig {
    /**
     * Default destination configuration for ArgoCD applications.
     */
    static destination(namespace: string): DeepOptional<ApplicationSpecDestination> {
        return {
            server: "https://kubernetes.default.svc",
            namespace,
        };
    }

    static annotations(): Record<string, string> {
        return {
            "argocd.argoproj.io/manifest-generate-paths": ".",
        };
    }

    /**
     * Default sync policy with automated sync, pruning, and self-healing.
     */
    static syncPolicy(autoSyncEnabled: boolean = true): DeepOptional<ApplicationSpecSyncPolicy> {
        return {
            automated: autoSyncEnabled
                ? {
                      prune: true,
                      selfHeal: true,
                      allowEmpty: true,
                  }
                : undefined,
            syncOptions: ["CreateNamespace=true"],
        };
    }

    /**
     * Enhanced sync policy with additional safety options.
     */
    static enhancedSyncPolicy(autoSyncEnabled: boolean = true): DeepOptional<ApplicationSpecSyncPolicy> {
        return {
            automated: autoSyncEnabled
                ? {
                      prune: true,
                      selfHeal: true,
                      allowEmpty: true,
                  }
                : undefined,
            syncOptions: ["CreateNamespace=true", "ApplyOutOfSyncOnly=true", "PruneLast=true", "ServerSideApply=true"],
        };
    }
}
