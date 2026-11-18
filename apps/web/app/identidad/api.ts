const API_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"
).replace(/\/$/, "");
const REQUEST_TIMEOUT_MS = 8000;

type JsonObject = Record<string, unknown>;

export type ApiErrorKind =
  | "network"
  | "timeout"
  | "http"
  | "invalid-response";

export class IdentityApiError extends Error {
  constructor(
    message: string,
    readonly kind: ApiErrorKind,
    readonly status = 0,
  ) {
    super(message);
    this.name = "IdentityApiError";
  }
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export type LoginResult =
  | { kind: "tokens"; tokens: TokenPair }
  | { kind: "mfa"; challengeToken: string; expiresIn: number }
  | { kind: "enrollment"; enrollmentToken: string; expiresIn: number };

type LoginResponse =
  | TokenPair
  | { mfaRequired: true; challengeToken: string; expiresIn: number }
  | { mfaSetupRequired: true; enrollmentToken: string; expiresIn: number };

export interface MfaSetup {
  qrCodeUrl: string;
  status: "pending_activation";
}

export interface RecoveryCodes {
  status: "active";
  recoveryCodes: string[];
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null;
}

function isMessage(value: unknown): value is { message: string } {
  return (
    isObject(value) &&
    typeof value.message === "string" &&
    value.message.trim().length > 0
  );
}

function isTokenPair(value: unknown): value is TokenPair {
  return (
    isObject(value) &&
    typeof value.accessToken === "string" &&
    value.accessToken.length > 0 &&
    typeof value.refreshToken === "string" &&
    value.refreshToken.length > 0 &&
    typeof value.expiresIn === "number" &&
    Number.isFinite(value.expiresIn) &&
    value.expiresIn > 0
  );
}

function isRecoveryCodes(value: unknown): value is RecoveryCodes {
  return (
    isObject(value) &&
    value.status === "active" &&
    Array.isArray(value.recoveryCodes) &&
    value.recoveryCodes.length === 10 &&
    value.recoveryCodes.every(
      (code) => typeof code === "string" && code.length > 0,
    )
  );
}

function errorFor(path: string, status: number): IdentityApiError {
  if (status === 429) {
    return new IdentityApiError(
      "Se alcanzó el límite de intentos. Espera un momento y vuelve a probar.",
      "http",
      status,
    );
  }

  if (path === "/auth/login" && status === 401) {
    return new IdentityApiError(
      "No fue posible iniciar sesión. Revisa tus datos y confirma que tu correo esté verificado.",
      "http",
      status,
    );
  }

  if (
    (path === "/auth/confirm-email" || path === "/auth/reset-password") &&
    (status === 400 || status === 404)
  ) {
    return new IdentityApiError(
      "El enlace no es válido o ya venció. Solicita uno nuevo si lo necesitas.",
      "http",
      status,
    );
  }

  if (status === 401) {
    return new IdentityApiError(
      "Tu sesión ya no es válida. Inicia sesión de nuevo.",
      "http",
      status,
    );
  }

  if (status >= 500) {
    return new IdentityApiError(
      "El servicio no pudo completar la solicitud. Inténtalo más tarde.",
      "http",
      status,
    );
  }

  if (status === 400) {
    return new IdentityApiError(
      "No se pudo completar la solicitud. Revisa los datos e inténtalo de nuevo.",
      "http",
      status,
    );
  }

  return new IdentityApiError(
    "No se pudo completar la solicitud.",
    "http",
    status,
  );
}

async function post<T>(
  path: string,
  body: unknown,
  isExpected: (value: unknown) => value is T,
  accessToken?: string,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS,
  );
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      cache: "no-store",
      signal: controller.signal,
    });
  } catch {
    const timedOut = controller.signal.aborted;
    throw new IdentityApiError(
      timedOut
        ? "La solicitud tardó demasiado. Vuelve a intentarlo."
        : "No se pudo conectar con el servicio. Comprueba tu conexión e inténtalo de nuevo.",
      timedOut ? "timeout" : "network",
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) throw errorFor(path, response.status);

  let result: unknown;
  try {
    result = await response.json();
  } catch {
    throw new IdentityApiError(
      "El servicio devolvió una respuesta que no se pudo leer.",
      "invalid-response",
      response.status,
    );
  }

  if (!isExpected(result)) {
    throw new IdentityApiError(
      "El servicio devolvió una respuesta inesperada.",
      "invalid-response",
      response.status,
    );
  }

  return result;
}

function isLoginResponse(value: unknown): value is LoginResponse {
  if (!isObject(value)) return false;
  if (isTokenPair(value)) return true;

  if (
    value.mfaRequired === true &&
    typeof value.challengeToken === "string" &&
    value.challengeToken.length > 0 &&
    typeof value.expiresIn === "number" &&
    Number.isFinite(value.expiresIn) &&
    value.expiresIn > 0
  ) {
    return true;
  }

  return (
    value.mfaSetupRequired === true &&
    typeof value.enrollmentToken === "string" &&
    value.enrollmentToken.length > 0 &&
    typeof value.expiresIn === "number" &&
    Number.isFinite(value.expiresIn) &&
    value.expiresIn > 0
  );
}

function isSetup(value: unknown): value is MfaSetup {
  if (!isObject(value) || typeof value.qrCodeUrl !== "string") return false;
  try {
    return new URL(value.qrCodeUrl).protocol === "otpauth:";
  } catch {
    return false;
  }
}

export const identidadApi = {
  register(input: {
    fullName: string;
    email: string;
    password: string;
    acceptsPrivacyPolicy: true;
  }) {
    return post("/auth/register", input, isMessage);
  },

  confirmEmail(token: string) {
    return post("/auth/confirm-email", { token }, isMessage);
  },

  login(input: { email: string; password: string }) {
    return post("/auth/login", input, isLoginResponse).then<LoginResult>(
      (response) => {
        if (isTokenPair(response)) {
          return { kind: "tokens", tokens: response };
        }
        if ("mfaRequired" in response) {
          return {
            kind: "mfa",
            challengeToken: response.challengeToken,
            expiresIn: response.expiresIn,
          };
        }
        return {
          kind: "enrollment",
          enrollmentToken: response.enrollmentToken,
          expiresIn: response.expiresIn,
        };
      },
    );
  },

  loginMfa(input: { challengeToken: string; code: string }) {
    return post("/auth/login/mfa", input, isTokenPair);
  },

  refresh(refreshToken: string) {
    return post("/auth/refresh", { refreshToken }, isTokenPair);
  },

  logout(accessToken: string) {
    return post("/auth/logout", {}, isMessage, accessToken);
  },

  forgotPassword(email: string) {
    return post("/auth/forgot-password", { email }, isMessage);
  },

  resetPassword(input: { token: string; password: string }) {
    return post("/auth/reset-password", input, isMessage);
  },

  setupMfa(accessToken: string) {
    return post("/auth/mfa/setup", {}, isSetup, accessToken);
  },

  verifyMfa(accessToken: string, code: string) {
    return post(
      "/auth/mfa/verify",
      { code },
      isRecoveryCodes,
      accessToken,
    );
  },

  setupRequiredMfa(enrollmentToken: string) {
    return post(
      "/auth/mfa/enrollment/setup",
      { enrollmentToken },
      isSetup,
    );
  },

  verifyRequiredMfa(input: { enrollmentToken: string; code: string }) {
    return post("/auth/mfa/enrollment/verify", input, isRecoveryCodes);
  },

  disableMfa(
    accessToken: string,
    input: { password: string; code: string },
  ) {
    return post("/auth/mfa/disable", input, isMessage, accessToken);
  },

  regenerateRecoveryCodes(accessToken: string, code: string) {
    return post(
      "/auth/mfa/recovery-codes",
      { code },
      isRecoveryCodes,
      accessToken,
    );
  },
};

export function isMfaFactorCode(value: string): boolean {
  return /^(?:\d{6}|(?:[A-Fa-f0-9]{8}-){3}[A-Fa-f0-9]{8})$/.test(
    value.trim(),
  );
}
