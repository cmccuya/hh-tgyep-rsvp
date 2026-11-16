import type { Metadata } from "next";
import { Register } from "@/components/portal-register";

export const metadata: Metadata = {
  title: "Register · Hamana Homes",
  description: "Ask for a Hamana Homes resident account. An admin approves it before you can sign in.",
};

export default function RegisterPage() {
  return <Register />;
}
