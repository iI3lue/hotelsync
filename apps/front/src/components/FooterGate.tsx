"use client";

import { usePathname } from "next/navigation";

/** Oculta el footer público dentro del panel de administración. */
export default function FooterGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname?.startsWith("/admin")) return null;
  return <>{children}</>;
}
