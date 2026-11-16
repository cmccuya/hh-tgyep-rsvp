import type { Metadata } from "next";
import { Gate } from "@/components/portal-gate";

export const metadata: Metadata = {
  title: "Sign in · Hamana Homes",
  description: "The resident gate for Hamana Homes in Sto. Rosario, Magalang.",
};

export default function LoginPage() {
  return <Gate />;
}
