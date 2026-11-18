import { Suspense } from "react";
import {
  IdentityPage,
  Notice,
} from "../identidad/components";
import ConfirmEmailClient from "./confirm-email-client";

interface ConfirmEmailPageProps {
  searchParams: Promise<{ token?: string | string[] }>;
}

async function ConfirmEmailContent({
  searchParams,
}: ConfirmEmailPageProps) {
  const query = await searchParams;
  const token = typeof query.token === "string" ? query.token : null;
  return <ConfirmEmailClient token={token} />;
}

function ConfirmEmailFallback() {
  return (
    <IdentityPage
      eyebrow="CONFIRMACIÓN DE CORREO"
      title="Activa tu cuenta."
      description="Confirma que esta dirección de correo te pertenece."
    >
      <h2>Verificando el enlace</h2>
      <Notice kind="info">Estamos comprobando el enlace. Espera un momento.</Notice>
    </IdentityPage>
  );
}

export default function ConfirmEmailPage(props: ConfirmEmailPageProps) {
  return (
    <Suspense fallback={<ConfirmEmailFallback />}>
      <ConfirmEmailContent searchParams={props.searchParams} />
    </Suspense>
  );
}