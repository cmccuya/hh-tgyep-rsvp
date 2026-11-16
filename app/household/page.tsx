import { Suspense } from "react";
import type { Metadata } from "next";
import { HouseholdFile } from "@/components/household-file";

export const metadata: Metadata = {
  title: "Household · Hamana Homes",
  description: "The household file for a Hamana Homes resident account.",
};

export default function HouseholdPage() {
  return (
    <Suspense fallback={<main className="portal waiting">Opening the household…</main>}>
      <HouseholdFile />
    </Suspense>
  );
}
