import type { DsaProductConfig, MockStore, Product } from "@/lib/types";

type ProductConfigStore = Pick<MockStore, "dsas" | "dsaProductConfigs">;

export function getActiveProductConfigs(
  store: ProductConfigStore,
  options: { dsaId?: string } = {},
) {
  const activeDsaIds = new Set(store.dsas.filter((dsa) => dsa.status === "Active").map((dsa) => dsa.id));

  return store.dsaProductConfigs
    .filter((config) => config.status === "Active" && activeDsaIds.has(config.dsaId))
    .filter((config) => !options.dsaId || config.dsaId === options.dsaId)
    .sort((left, right) => left.dsaName.localeCompare(right.dsaName) || left.product.localeCompare(right.product));
}

export function getUniqueProductConfigs(configs: DsaProductConfig[]) {
  const products = new Set<Product>();

  return configs.filter((config) => {
    if (products.has(config.product)) return false;
    products.add(config.product);
    return true;
  });
}

export function resolveProductConfig(
  configs: DsaProductConfig[],
  product: Product | "",
  preferredDsaId = "",
) {
  if (!product) return undefined;

  return (
    (preferredDsaId
      ? configs.find((config) => config.dsaId === preferredDsaId && config.product === product)
      : undefined) ?? configs.find((config) => config.product === product)
  );
}
