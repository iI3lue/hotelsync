import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Personal",
  description: "Cuentas de recepción y limpieza del hotel.",
};

export default function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
