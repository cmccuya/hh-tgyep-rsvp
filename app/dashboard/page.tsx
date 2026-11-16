import type { Metadata } from "next";
import { PortalHome } from "@/components/portal-home";

export const metadata: Metadata = {
  title: "Home · Hamana Homes",
  description: "Notices, the club house calendar, and your Hamana Homes household.",
};

export default function DashboardPage() {
  return <PortalHome />;
}
