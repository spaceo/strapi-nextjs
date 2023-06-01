"use client";
import { HorizontalGrid } from "@shopify/polaris";

export default function ProviderGrid({ children }: { children: any }) {
  return (
    <HorizontalGrid gap="4" columns={3}>
      {children}
    </HorizontalGrid>
  );
}
