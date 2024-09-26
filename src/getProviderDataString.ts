import { notEmpty } from "./edge-util";
import { Provider } from "./types";
export const getProviderDataString = (provider: Provider) => {
  return [
    provider.providerSlug,
    provider.info?.title,
    provider.info?.description?.slice(0, 120),
    provider.categories?.join(","),
  ]
    .filter(notEmpty)
    .join(" - ");
};
