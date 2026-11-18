import { Suspense } from "react";
import {
  IdentityPage,
  Notice,
} from "../identidad/components";
import ResetPasswordClient from "./reset-password-client";

interface ResetPasswordPageProps {
  searchParams: Promise<{ token?: string | string[] }>;
}

async function ResetPasswordContent({
  searchParams,
}: ResetPasswordPageProps) {
  const query = await searchParams;
  const token = typeof query.token === "string" ? query.token : null;
  return <ResetPasswordClient token={token} />;
}

function ResetPasswordFallback() {
  return (
    <IdentityPage
      eyebrow="SEGURIDAD DE LA CUENTA"
      title="Elige una contraseña nueva."
      description="Usa una contraseña que no hayas utilizado en otro servicio."
    >
      <h2>Preparando el restablecimiento</h2>
      <Notice kind="info">Comprobando el enlace recibido.</Notice>
    </IdentityPage>
  );
}

export default function ResetPasswordPage(props: ResetPasswordPageProps) {
  return (
    <Suspense fallback={<ResetPasswordFallback />}>
      <ResetPasswordContent searchParams={props.searchParams} />
    </Suspense>
  );
}
