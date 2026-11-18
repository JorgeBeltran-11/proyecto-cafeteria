import type { Metadata } from "next";
import { IdentitySessionProvider } from "./identidad/session-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cafetería | Un buen café cambia tu día",
  description:
    "Descubre nuestra cafetería y crea tu cuenta para comenzar tu experiencia.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es">
      <body>
        <IdentitySessionProvider>{children}</IdentitySessionProvider>
      </body>
    </html>
  );
}