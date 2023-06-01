export const formatServiceData = (services: any) => {
  return services.map(({ id, attributes }: any) => ({
    id,
    name: attributes.Title ?? "No title",
  }));
}