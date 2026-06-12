import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/https";

initializeApp();

const db = getFirestore();

type JournalLine = {
  accountId: string;
  debit?: number;
  credit?: number;
};

async function assertCompanyAccess(uid: string, companyId: string) {
  const user = await db.collection("users").doc(uid).get();
  if (!user.exists || user.data()?.companyId !== companyId) {
    throw new HttpsError("permission-denied", "User cannot access this company.");
  }
}

export const aggregateDashboard = onCall({ region: "asia-southeast2" }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }

  const companyId = String(request.data?.companyId ?? "");
  if (!companyId) {
    throw new HttpsError("invalid-argument", "companyId is required.");
  }

  await assertCompanyAccess(request.auth.uid, companyId);

  const [accountsSnapshot, journalsSnapshot] = await Promise.all([
    db.collection("accounts").where("companyId", "==", companyId).get(),
    db.collection("journal_entries").where("companyId", "==", companyId).where("status", "in", ["posted", "locked"]).get(),
  ]);

  const accounts = new Map<string, { type: string; normalBalance: "debit" | "credit" }>();
  accountsSnapshot.docs.forEach((doc) => {
    const data = doc.data();
    accounts.set(doc.id, {
      type: String(data.type),
      normalBalance: data.normalBalance === "credit" ? "credit" : "debit",
    });
  });

  const totals = {
    revenue: 0,
    expenses: 0,
    assets: 0,
    liabilities: 0,
    equity: 0,
  };

  journalsSnapshot.docs.forEach((doc) => {
    const lines = (doc.data().lines ?? []) as JournalLine[];
    lines.forEach((line) => {
      const account = accounts.get(line.accountId);
      if (!account) return;
      const debit = Number(line.debit ?? 0);
      const credit = Number(line.credit ?? 0);

      if (account.type === "revenue") totals.revenue += credit - debit;
      if (account.type === "expense") totals.expenses += debit - credit;
      if (account.type === "asset") totals.assets += debit - credit;
      if (account.type === "liability") totals.liabilities += credit - debit;
      if (account.type === "equity") totals.equity += account.normalBalance === "credit" ? credit - debit : debit - credit;
    });
  });

  return {
    ...totals,
    netProfit: totals.revenue - totals.expenses,
    generatedAt: new Date().toISOString(),
  };
});
