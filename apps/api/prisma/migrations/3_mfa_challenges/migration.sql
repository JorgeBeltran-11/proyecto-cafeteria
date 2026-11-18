CREATE TABLE "MfaChallenge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MfaChallenge_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "MfaChallenge_tokenHash_key" ON "MfaChallenge"("tokenHash");

CREATE INDEX "MfaChallenge_accountId_purpose_usedAt_idx" ON "MfaChallenge"("accountId", "purpose", "usedAt");

CREATE INDEX "MfaChallenge_expiresAt_idx" ON "MfaChallenge"("expiresAt");
