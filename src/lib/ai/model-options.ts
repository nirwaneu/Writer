export type ProviderModelGroup = {
  providerId: string;
  providerName: string;
  models: string[];
  error: string | null;
};

export type ModelOption = {
  value: string;
  providerId: string;
  providerName: string;
  model: string;
  label: string;
};
