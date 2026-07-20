import "server-only";

export class AccountAccessDeniedError extends Error {
  constructor(message = "Not authorized for this account.") {
    super(message);
    this.name = "AccountAccessDeniedError";
  }
}

/**
 * Explicit app-layer ownership check — required whenever code uses the admin
 * (secret-key) client, since that client bypasses RLS entirely. RLS is the
 * database-level guarantee; this is the code-level guarantee. Both must hold
 * independently — this is what makes it defense-in-depth rather than a single
 * point of failure.
 */
export function assertAccountOwnership(resourceAccountId: string, callerAccountId: string): void {
  if (resourceAccountId !== callerAccountId) {
    throw new AccountAccessDeniedError();
  }
}
