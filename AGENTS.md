# AGENTS.MD - ArgoTS Framework

## Project Identity

**What:** A generic, open-source framework for building self-deploying Kubernetes infrastructure using TypeScript.
**How:** Runs as an ArgoCD [Config Management Plugin (CMP)](https://argo-cd.readthedocs.io/en/stable/user-guide/config-management-plugins/) — ArgoCD invokes the consumer's entry point with an env var specifying which component to output.
**Why:** Type-safe, composable, hierarchical infrastructure with automatic ArgoCD Application generation.
**Package:** `@mortaelth2/argo-ts` on GitHub Packages (npm).

**Tech stack:** TypeScript 5.9, cdk8s 2.70, Node 24, pnpm.
**Peer dependencies:** `cdk8s`, `constructs`.
**License:** Apache 2.0.

---

## Architecture: Self-Deploying Hierarchy

The core innovation: components extending `ArgoBootstrapApp` automatically generate ArgoCD `Application` CRs for their children, creating a recursive deployment tree.

```
ArgoCD calls plugin with ARGOCD_ENV_component=root
  -> RootBuilder.build() creates child components
  -> bootstrap() discovers children that extend ArgoBootstrapApp
  -> Generates an Application CR for each child, pointing back to the same repo
  -> Each Application has its own ARGOCD_ENV_component value (= child's construct path)
  -> ArgoCD deploys each child Application, calling the plugin again
  -> Repeat recursively
```

### Component Filtering

The `ARGOCD_ENV_component` env var controls what gets built:

| Filter value | What builds |
|---|---|
| `undefined` / empty | Everything |
| `root` | Root + all children |
| `root/builder/app` | Only that specific app |
| `root/builder` | Builder + all its children |

**Logic** (`ComponentFilter.shouldInclude()`): A component builds if the filter is empty, matches exactly, or the filter starts with `componentPath + "/"` (this component is an ancestor of the target).

---

## Key Abstractions

### ArgoBootstrapApp (`src/argoApp.ts`)

Abstract base class extending cdk8s `Chart`. **All deployable components** extend this.

**Constructor flow:**
1. `shouldBuildComponent()` — checks `ARGOCD_ENV_component` filter
2. If should build: calls `this.build()` (abstract, subclass implements)
3. Calls `bootstrap()` — auto-creates ArgoCD Application CRs for all direct `ArgoBootstrapApp` children

**Props (`ArgoBootstrapAppProps`):**

| Prop | Type | Default | Description |
|---|---|---|---|
| `gitConfig` | `GitConfig` | required | Git repo URL, path, revision |
| `project` | `string` | `"default"` | ArgoCD project name (inherited down the tree) |
| `autoSyncEnabled` | `boolean` | `true` | ArgoCD auto-sync (inherited down the tree) |
| `namespace` | `string` | `"default"` | Target K8s namespace |
| `argoAppSpec` | `DeepOptional<ApplicationSpec>` | — | Override any ArgoCD Application spec fields |
| `additionalSources` | `DeepOptional<ApplicationSpecSources>[]` | — | Additional sources for multi-source Applications |

**Tree-walking resolution:** Both `project` and `autoSyncEnabled` use `resolve*()` methods that check the current component's props, then walk up the construct tree to inherit from the nearest `ArgoBootstrapApp` ancestor.

### ArgoApplication / ArgoApplicationSet (`src/argoApp.ts`)

Wrappers around ArgoCD CRDs. Created automatically by `bootstrap()` or manually in `build()`.

- Extend the cdk8s-generated `Application` / `ApplicationSet` classes
- The generated `toJson()` handles property name conversion (e.g., `repoUrl` in TypeScript -> `repoURL` in YAML manifest)
- Defaults: automated prune + self-heal, `ServerSideApply`, `ApplyOutOfSyncOnly`, `PruneLast`

**Important:** Use `repoUrl` (camelCase) in TypeScript code, NOT `repoURL`. The generated types handle the conversion.

### SynthesisFileManager / ComponentOutputManager (`src/bootstrap.ts`)

- `SynthesisFileManager.renameSynthFiles(app)` — renames cdk8s output files to clean names
- `ComponentOutputManager.printComponentToStdout(rootComponent)` — selects and outputs the manifest for the requested component

### SOPS Support (`src/sops.ts`)

Generic SOPS decrypt + cache + optional obfuscation:

```typescript
readSopsFile<T>(filePath, options?)        // Decrypt single file
loadAndMergeSecrets<T>(global, local, options?) // Decrypt + merge two files
clearSecretsCache()                        // Clear cached decryptions
```

Options: `{ obfuscate?: boolean, decode?: boolean }`. Obfuscation defaults ON unless `OBFUSCATE_SECRETS=false`.

---

## Directory Structure

```
.
├── src/
│   ├── index.ts              # Barrel export of all framework modules
│   ├── argoApp.ts            # ArgoBootstrapApp, ArgoApplication, ArgoApplicationSet, DefaultArgoConfig
│   ├── bootstrap.ts          # SynthesisFileManager, ComponentOutputManager, ComponentFilter
│   ├── types.ts              # GitConfig interface
│   ├── sops.ts               # Generic SOPS decrypt/cache/obfuscate
│   ├── secretsDecode.ts      # Base64 decode utility (decodeGlobalSecrets, isBase64)
│   ├── k8sTypes.ts           # Resources, ContainerConf type definitions
│   ├── k8sFunctions.ts       # convertToK8sResources()
│   ├── mergeAndUnsetNulls.ts # Deep merge with null removal
│   ├── deepObfuscate.ts      # Secret masking for logs
│   ├── memoryRatio.ts        # Memory/CPU ratio calculation
│   ├── base64.ts             # Encoding/decoding (btoa, atob)
│   ├── utilityTypes.ts       # DeepOptional, DeepRequired
│   ├── getRepoRelativePath.ts
│   └── types/argocd/
│       └── argoproj.io.ts    # Generated ArgoCD CRD types (cdk8s import)
│
├── docker/Dockerfile         # Generic CMP container (Alpine + Node + Helm + SOPS + cdk8s-cli)
├── scripts/
│   └── import-argocd-types.sh # Downloads ArgoCD CRDs and regenerates types
├── spec/                     # Tests
├── package.json
└── tsconfig.json             # outDir: dist, rootDir: src
```

**Build output:** `dist/` (published to npm). Consumers import from `@mortaelth2/argo-ts`.

---

## ArgoCD CRD Types

Types in `src/types/argocd/argoproj.io.ts` are generated from ArgoCD CRDs using `cdk8s import`.

**To regenerate for a specific ArgoCD version:**
```bash
./scripts/import-argocd-types.sh v2.13.3
```

This downloads CRDs from the ArgoCD GitHub repo and runs `cdk8s import`.

**Property naming:** Generated types use camelCase (e.g., `repoUrl`, `targetRevision`). The `toJson()` methods handle conversion to the K8s API names (e.g., `repoURL`). Always use camelCase in TypeScript.

---

## How Consumers Use This Framework

```typescript
import { ArgoBootstrapApp, ArgoBootstrapAppProps, SynthesisFileManager, ComponentOutputManager } from "@mortaelth2/argo-ts";
import { App } from "cdk8s";

class MyApp extends ArgoBootstrapApp {
    protected build(): void {
        // Define K8s resources using cdk8s / Helm
    }
}

class RootBuilder extends ArgoBootstrapApp {
    protected build(): void {
        new MyApp(this, "my-app", { gitConfig: this.gitConfig, namespace: "my-ns" }, {});
    }
}

const app = new App({ outdir: "dist" });
new RootBuilder(app, "root", {
    gitConfig: { gitRepoUrl: "https://github.com/org/repo.git", path: "." },
    project: "my-project",
}, {});
app.synth();
SynthesisFileManager.renameSynthFiles(app);
ComponentOutputManager.printComponentToStdout("root");
```

---

## Development

```bash
pnpm install          # Install dependencies
pnpm build            # Compile TypeScript -> dist/
pnpm test             # Run tests
pnpm run prettier-fix # Format code
pnpm run check-circular-deps # Check for circular imports
```

### Formatting

Prettier: `tabWidth: 4`, `printWidth: 140`, `trailingComma: "all"`. YAML/JSON: `tabWidth: 2`.

---

## Environment Variables

| Variable | Purpose | Default |
|---|---|---|
| `ARGOCD_ENV_component` | Component filter path | Empty (build all) |
| `OBFUSCATE_SECRETS` | Set to `"false"` for real secrets | Enabled (obfuscated) |
