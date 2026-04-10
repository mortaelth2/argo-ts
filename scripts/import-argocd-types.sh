#!/usr/bin/env bash
set -euo pipefail

# Downloads ArgoCD CRDs for a specific version and generates TypeScript types using cdk8s import.
#
# Usage: ./scripts/import-argocd-types.sh <argocd-version>
# Example: ./scripts/import-argocd-types.sh v2.13.3

ARGOCD_VERSION="${1:?Usage: $0 <argocd-version> (e.g., v2.13.3)}"

# Ensure version starts with 'v'
[[ "$ARGOCD_VERSION" != v* ]] && ARGOCD_VERSION="v${ARGOCD_VERSION}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
OUTPUT_DIR="$PROJECT_ROOT/src/types/argocd"

TMP_DIR=$(mktemp -d)
trap "rm -rf $TMP_DIR" EXIT

echo "Downloading ArgoCD CRDs ${ARGOCD_VERSION}..."

CRDS=(
    "application-crd.yaml"
    "applicationset-crd.yaml"
    "appproject-crd.yaml"
)

for crd in "${CRDS[@]}"; do
    echo "  Fetching ${crd}..."
    curl -fsSL "https://raw.githubusercontent.com/argoproj/argo-cd/${ARGOCD_VERSION}/manifests/crds/${crd}" -o "$TMP_DIR/$crd"
done

# Combine all CRDs into a single file for cdk8s import
cat "$TMP_DIR"/*.yaml > "$TMP_DIR/all-crds.yaml"

echo "Generating TypeScript types into ${OUTPUT_DIR}..."
mkdir -p "$OUTPUT_DIR"
npx cdk8s import "$TMP_DIR/all-crds.yaml" -o "$OUTPUT_DIR"

echo ""
echo "Done. ArgoCD ${ARGOCD_VERSION} types generated in ${OUTPUT_DIR}"
echo "Remember to commit the generated files."
