import "./front-page.css";
import { Suspense } from "react";
import Providers from "./components/providers";
import WelcomeText from "./components/velcomeText";

export default async function Home() {
  return (
    <>
      <WelcomeText />
      <Suspense>
        {/* @ts-expect-error Server Component */}
        <Providers />
      </Suspense>
    </>
  );
}
