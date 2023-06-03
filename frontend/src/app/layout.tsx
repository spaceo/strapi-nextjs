import { Inter } from "next/font/google";
import "@shopify/polaris/build/esm/styles.css";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Profekto - Find en leverandør",
  description: "Find ydelser til hjemmet",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className}`}>
        <div className="m-20">{children}</div>
      </body>
    </html>
  );
}
