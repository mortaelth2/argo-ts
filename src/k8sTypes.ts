export type SimpleContainerConf = {
    version: string;
    image: string;
};

interface ContainerSettings {
    resources: Resources;
    replicas: number;
    affinity?: Object;
}

export type ContainerConf = SimpleContainerConf & ContainerSettings;

export type ExternalContainerConf = ContainerSettings;
export type OptionalExternalContainerConf = Partial<ContainerConf>;

export interface Resources {
    requests_cpu?: string;
    requests_memory: string;
    limits_cpu?: string;
    limits_memory?: string;
}

export type OptionalResources = Partial<Resources>;
export type RequiredResources = Required<Resources>;
