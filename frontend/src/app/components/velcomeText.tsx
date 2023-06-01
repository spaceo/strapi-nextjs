"use client";
import { Text } from "@shopify/polaris";

export default function WelcomeText() {
  return (
    <>
      <div className="mb-10">
        <Text as="h1" variant="heading4xl">
          Velkommen til Profekto
        </Text>
      </div>
      <Text as="h2" variant="heading2xl">
        Leverandører
      </Text>
    </>
  );
}
