import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Analítica",
  description: "Ocupación, ADR y RevPAR por hotel.",
};

export default function AnalyticsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
