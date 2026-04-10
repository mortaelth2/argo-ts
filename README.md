# argo-ts

A [cdk8s](https://cdk8s.io/)-based [ArgoCD Config Management Plugin](https://argo-cd.readthedocs.io/en/stable/operator-manual/config-management-plugins/) framework that provides a **self-deploying component hierarchy** for Kubernetes infrastructure.

## What is ArgoTS?

ArgoTS lets you define your Kubernetes infrastructure as a tree of TypeScript classes. Each class extending `ArgoBootstrapApp` automatically generates ArgoCD `Application` CRs for its children, creating a recursive self-deploying tree. ArgoCD then manages each component independently.

**Key features:**

- **Self-deploying hierarchy** -- Define a root builder and leaf components; ArgoCD Application manifests are generated automatically
- **Component filtering** -- Build individual components via `ARGOCD_ENV_component` environment variable
- **SOPS secrets** -- Decrypt, cache, and optionally obfuscate SOPS-encrypted JSON secrets
- **General K8s utilities** -- Resource conversion, memory ratio calculation, deep merge with null removal

## Quick Start

```bash
npm install argo-ts
# peer dependencies
npm install cdk8s constructs @kubernetes-models/argo-cd
```

### Minimal Example

```typescript
import { App } from "cdk8s";
import { ArgoBootstrapApp, ArgoBootstrapAppProps, SynthesisFileManager, ComponentOutputManager } from "argo-ts";
import { Construct } from "constructs";

// A leaf component that creates Kubernetes resources
class MyApp extends ArgoBootstrapApp {
    protected build(): void {
        // Define your K8s resources here using cdk8s
    }
}

// A builder that composes leaf components into a tree
class RootBuilder extends ArgoBootstrapApp {
    protected build(): void {
        new MyApp(this, "my-app", {
            gitConfig: this.gitConfig,
            namespace: "my-namespace",
        }, {});
    }
}

// Entry point
const app = new App({ outdir: "dist" });
new RootBuilder(app, "root", {
    gitConfig: {
        gitRepoUrl: "https://github.com/your-org/your-infra.git",
        path: ".",
    },
    project: "default",
}, {});

app.synth();
SynthesisFileManager.renameSynthFiles(app);
ComponentOutputManager.printComponentToStdout("root");
```

## ArgoCD CMP Plugin Setup

ArgoTS works as an ArgoCD [Config Management Plugin](https://argo-cd.readthedocs.io/en/stable/operator-manual/config-management-plugins/). The plugin name is `argo-ts` -- configure your ArgoCD sidecar container to match:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: cmp-plugin
data:
  plugin.yaml: |
    apiVersion: argoproj.io/v1alpha1
    kind: ConfigManagementPlugin
    metadata:
      name: argo-ts
    spec:
      generate:
        command: [sh, -c, "node index.js"]
```

Use the provided [Dockerfile](docker/Dockerfile) as the sidecar image (Alpine + Node + Helm + SOPS + cdk8s-cli).

## API Reference

### `ArgoBootstrapApp`

Abstract base class. Extend it to define components:

| Prop | Type | Default | Description |
|---|---|---|---|
| `gitConfig` | `GitConfig` | required | Git repo URL, path, and revision |
| `project` | `string` | `"default"` | ArgoCD project name (inherited down the tree) |
| `autoSyncEnabled` | `boolean` | `true` | Enable ArgoCD auto-sync (inherited down the tree) |
| `namespace` | `string` | `"default"` | Target Kubernetes namespace |
| `argoAppSpec` | `DeepOptional<IApplication["spec"]>` | -- | Override any ArgoCD Application spec fields |
| `additionalSources` | `IApplication["spec"]["sources"]` | -- | Additional sources for multi-source Applications |

### SOPS Secrets

```typescript
import { readSopsFile, loadAndMergeSecrets, clearSecretsCache } from "argo-ts";

// Read a single encrypted file
const secrets = readSopsFile<MySecrets>("path/to/secrets.enc.json");

// Merge global + local secrets
const merged = loadAndMergeSecrets<MySecrets>("global.enc.json", "local.enc.json");

// Options: disable obfuscation or base64 decoding
const raw = readSopsFile<MySecrets>("secrets.enc.json", { obfuscate: false, decode: false });
```

## Regenerating ArgoCD Types

To update the bundled ArgoCD CRD types for a specific version:

```bash
./scripts/import-argocd-types.sh v2.13.3
```

This downloads CRDs from the ArgoCD GitHub repository and generates TypeScript types using `cdk8s import`.

## License

Apache 2.0
