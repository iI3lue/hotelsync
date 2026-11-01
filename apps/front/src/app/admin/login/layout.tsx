import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Acceso administrativo",
  description: "Ingreso al panel de administración de HotelSync.",
};

export default function AdminLoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
