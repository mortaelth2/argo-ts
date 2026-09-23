# https://github.com/nodejs/node/releases
ARG NODE_VERSION=24.7.0
# https://github.com/cdk8s-team/cdk8s-cli/releases
ARG CDK8S_CLI_VERSION=2.201.15
# https://alpinelinux.org/releases/
ARG ALPINE_VERSION=3.22
# https://github.com/helm/helm/releases
ARG HELM_VERSION=3.16.4
# https://github.com/getsops/sops/releases
ARG SOPS_VERSION=3.10.2
# https://github.com/pnpm/pnpm/releases
# Pinned, not floating: an unpinned `npm install -g pnpm` moved this image from pnpm 10 to 12 on
# a rebuild and broke every render. Must stay on 10.x. pnpm 12.4.2 does not expand ${VAR} in
# .npmrc (verified against a local registry: pnpm 10 sends `Authorization: Bearer <token>`, pnpm
# 12 sends no header at all), and consumers authenticate to the GitLab npm registry with
# `_authToken=${GITLAB_TOKEN}` — so on 12 every install fails 401. A literal token works there,
# and npm_config_-style auth env does not, so there is no workaround short of 10.x.
ARG PNPM_VERSION=10.33.0

FROM --platform=${TARGETPLATFORM} node:${NODE_VERSION}-alpine AS node

FROM alpine:${ALPINE_VERSION}

ARG HELM_VERSION
ARG TARGETOS
ARG TARGETARCH
ARG SOPS_VERSION
ARG PNPM_VERSION

USER root

RUN addgroup -g 1000 argocd && \
    adduser -S -u 999 -G argocd -h /home/argocd argocd && \
    mkdir -p /home/argocd && \
    chown argocd:0 /home/argocd && \
    chmod g=u /home/argocd

COPY --from=node /usr/lib /usr/lib
COPY --from=node /usr/local/lib /usr/local/lib
COPY --from=node /usr/local/include /usr/local/include
COPY --from=node /usr/local/bin /usr/local/bin

# Install node-based tools
RUN npm install -g cdk8s-cli@${CDK8S_CLI_VERSION} ts-node pnpm@${PNPM_VERSION}

# Consumer app dirs pin their own `packageManager` (three different pnpm versions across the
# cluster envs today), and pnpm honours that by downloading @pnpm/exe of that exact version.
# @pnpm/exe ships no linux-x64-musl build before 12.x, so on this Alpine base that download fails
# and the render dies with ERR_PNPM_PNPM_ENGINE_NO_NATIVE_BINARY. Disabling the switch makes the
# pnpm installed above authoritative, so no consumer's pin can break a render.
#
# This is the pnpm 10 spelling. pnpm >= 11 renamed it to pmOnFail (PNPM_CONFIG_PM_ON_FAIL=ignore)
# and IGNORES this one — so a pnpm bump here silently re-enables the switch. See the version note.
ENV npm_config_manage_package_manager_versions=false

# Install Helm CLI (multi-arch)
RUN apk add --no-cache curl ca-certificates tar gzip && \
    curl -fsSL https://get.helm.sh/helm-v${HELM_VERSION}-${TARGETOS:-linux}-${TARGETARCH:-amd64}.tar.gz -o /tmp/helm.tgz && \
    tar -C /tmp -xzf /tmp/helm.tgz && \
    mv /tmp/${TARGETOS:-linux}-${TARGETARCH:-amd64}/helm /usr/local/bin/helm && \
    chmod +x /usr/local/bin/helm && \
    rm -rf /tmp/*


RUN set -eux; \
    curl -fsSL "https://github.com/getsops/sops/releases/download/v${SOPS_VERSION}/sops-v${SOPS_VERSION}.linux.${TARGETARCH:-amd64}" -o /usr/local/bin/sops; \
    chmod +x /usr/local/bin/sops; \
    /usr/local/bin/sops --version

USER argocd
WORKDIR /home/argocd

ENTRYPOINT ["/var/run/argocd/argocd-cmp-server"]
