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

FROM --platform=${TARGETPLATFORM} node:${NODE_VERSION}-alpine AS node

FROM alpine:${ALPINE_VERSION}

ARG HELM_VERSION
ARG TARGETOS
ARG TARGETARCH
ARG SOPS_VERSION

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
RUN npm install -g cdk8s-cli@${CDK8S_CLI_VERSION} ts-node pnpm

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
