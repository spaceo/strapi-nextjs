import { Service } from "@/types/types";

export const formatServiceData = (services: Service[]) => {
  return services.map(({ id, attributes }: any) => ({
    id,
    name: attributes.Title ?? "No title",
  }));
}