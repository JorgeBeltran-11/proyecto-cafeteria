import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Proyecto cafetería",
  description: "Estado de la API y de la base de datos de la cafetería.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
