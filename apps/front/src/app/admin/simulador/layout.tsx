import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Simulador de reservas",
  description: "Simulación de reservas y disponibilidad.",
};

export default function SimulatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
