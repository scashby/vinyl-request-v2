import { requireCurrentAccount } from "@/lib/account/requireCurrentAccount";
import SignOutButton from "./SignOutButton";

export default async function DashboardPage() {
  const account = await requireCurrentAccount();

  return (
    <main>
      <h1>{account.accountName}</h1>
      <p>
        Signed in as {account.userEmail} ({account.role})
      </p>
      <p>Plan: {account.planTier}</p>
      <p>No games set up yet.</p>
      <SignOutButton />
    </main>
  );
}
