"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  createOpeningBalanceFirestore,
  updateBusinessProfileFirestore,
} from "@/lib/firestore/company-service";
import { useKasFlowStore } from "@/store/use-kasflow-store";

export default function OnboardingPage() {
  const { appUser } = useAuth();
  const profile = useKasFlowStore((state) => state.profile);
  const updateProfile = useKasFlowStore((state) => state.updateProfile);
  const createOpeningBalance = useKasFlowStore(
    (state) => state.createOpeningBalance,
  );
  const cashAccounts = useKasFlowStore((state) => state.cashAccounts);
  const [step, setStep] = useState(1);
  const [template, setTemplate] = useState(profile.businessType);
  const [openingCashAccount, setOpeningCashAccount] = useState(
    cashAccounts[0]?.accountId ?? "1110",
  );
  const [openingBalance, setOpeningBalance] = useState(0);
  const [message, setMessage] = useState<string | null>(null);

  const persistProfile = async (partialProfile: Partial<typeof profile>) => {
    updateProfile(partialProfile);
    if (appUser)
      await updateBusinessProfileFirestore(appUser.companyId, {
        ...profile,
        ...partialProfile,
      });
  };

  const handleOpeningBalance = async () => {
    if (appUser) {
      await createOpeningBalanceFirestore(
        appUser.companyId,
        openingCashAccount,
        openingBalance,
        "debit",
      );
    } else {
      createOpeningBalance(openingCashAccount, openingBalance, "debit");
    }
    setMessage("Opening balance berhasil dibuat.");
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Badge>Onboarding Wizard</Badge>
        <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
          Setup Awal KasFlow
        </h2>
        <p className="mt-1 text-muted-foreground">
          Step 1 Business Profile, Step 2 Template Selection, Step 3 Opening
          Balance.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Step {step} dari 3</CardTitle>
          <CardDescription>
            {step === 1
              ? "Business Profile"
              : step === 2
                ? "Template Selection"
                : "Opening Balance"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === 1 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Business Name</Label>
                <Input
                  value={profile.businessName}
                  onChange={(event) =>
                    persistProfile({ businessName: event.target.value })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>Owner Name</Label>
                <Input
                  value={profile.ownerName}
                  onChange={(event) =>
                    persistProfile({ ownerName: event.target.value })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>Business Type</Label>
                <Select
                  value={profile.businessType}
                  onChange={(event) =>
                    persistProfile({
                      businessType: event.target
                        .value as typeof profile.businessType,
                    })
                  }
                >
                  <option value="retail">Retail</option>
                  <option value="service">Service</option>
                  <option value="online_shop">Online Shop</option>
                  <option value="distributor">Distributor</option>
                  <option value="freelancer">Freelancer</option>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Tax Number</Label>
                <Input
                  value={profile.taxNumber ?? ""}
                  onChange={(event) =>
                    persistProfile({ taxNumber: event.target.value })
                  }
                />
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {["retail", "service", "online_shop", "distributor"].map(
                (item) => (
                  <button
                    key={item}
                    className={`rounded-xl border p-5 text-left transition hover:bg-muted ${template === item ? "border-primary bg-primary/10" : "bg-card"}`}
                    onClick={() => setTemplate(item as typeof template)}
                  >
                    <p className="font-semibold capitalize">
                      {item.replace("_", " ")}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Template COA dan kategori default.
                    </p>
                  </button>
                ),
              )}
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-4">
              <div className="grid gap-2">
                <Label>Cash Account</Label>
                <Select
                  value={openingCashAccount}
                  onChange={(event) =>
                    setOpeningCashAccount(event.target.value)
                  }
                >
                  {cashAccounts.map((account) => (
                    <option key={account.id} value={account.accountId}>
                      {account.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Opening Balance</Label>
                <Input
                  type="number"
                  value={openingBalance || ""}
                  onChange={(event) =>
                    setOpeningBalance(Number(event.target.value))
                  }
                />
              </div>
              <Button onClick={handleOpeningBalance}>
                Generate Opening Journal
              </Button>
            </div>
          ) : null}

          {message ? (
            <p className="rounded-xl bg-muted p-3 text-sm">{message}</p>
          ) : null}

          <div className="flex items-center justify-between border-t pt-4">
            <Button
              variant="outline"
              disabled={step === 1}
              onClick={() => setStep((value) => Math.max(1, value - 1))}
            >
              Back
            </Button>
            {step < 3 ? (
              <Button
                onClick={() => setStep((value) => Math.min(3, value + 1))}
              >
                Next
              </Button>
            ) : (
              <Link href="/">
                <Button>Finish</Button>
              </Link>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
