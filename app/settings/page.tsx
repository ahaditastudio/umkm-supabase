"use client";

import Link from "next/link";
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
import { isFirebaseConfigured } from "@/lib/firebase";
import { updateBusinessProfileFirestore } from "@/lib/firestore/company-service";
import { formatDate } from "@/lib/utils";
import { useKasFlowStore } from "@/store/use-kasflow-store";

export default function SettingsPage() {
  const { appUser } = useAuth();
  const profile = useKasFlowStore((state) => state.profile);
  const updateProfile = useKasFlowStore((state) => state.updateProfile);
  const accountingPeriods = useKasFlowStore((state) => state.accountingPeriods);

  const persistProfile = async (partialProfile: Partial<typeof profile>) => {
    updateProfile(partialProfile);
    if (appUser)
      await updateBusinessProfileFirestore(appUser.companyId, {
        ...profile,
        ...partialProfile,
      });
  };

  return (
    <div className="space-y-6">
      <div>
        <Badge tone="muted">Settings</Badge>
        <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
          Pengaturan
        </h2>
        <p className="mt-1 text-muted-foreground">
          Business profile, accounting period, role management, dan Firebase
          config.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <Card>
          <CardHeader>
            <CardTitle>Business Profile</CardTitle>
            <CardDescription>
              Step 1 onboarding: business name, owner, business type, tax
              number.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
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
                placeholder="NPWP/NIK"
              />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Firebase</CardTitle>
              <CardDescription>
                Auth, Firestore, Storage, Functions, Hosting.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Badge tone={isFirebaseConfigured ? "green" : "yellow"}>
                {isFirebaseConfigured ? "Configured" : "Env needed"}
              </Badge>
              <p className="text-sm text-muted-foreground">
                Isi `.env.local` dari `.env.example`, lalu deploy rules dari
                `firestore.rules` dan `storage.rules`.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Onboarding Wizard</CardTitle>
              <CardDescription>
                Business profile → template → opening balance.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/onboarding">
                <Button className="w-full">Buka Onboarding</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Accounting Period</CardTitle>
            <CardDescription>Settings → Accounting Period.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {accountingPeriods.map((period) => (
              <div
                key={period.id}
                className="flex items-center justify-between rounded-xl bg-muted p-4 text-sm"
              >
                <div>
                  <p className="font-medium">
                    {formatDate(period.startDate)} -{" "}
                    {formatDate(period.endDate)}
                  </p>
                  {period.closedAt ? (
                    <p className="text-muted-foreground">
                      Closed at {formatDate(period.closedAt)}
                    </p>
                  ) : null}
                </div>
                <Badge tone={period.status === "open" ? "green" : "red"}>
                  {period.status}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Role Management</CardTitle>
            <CardDescription>Owner, Accountant, Staff.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border bg-muted/40 p-4">
              <p className="font-semibold">Owner</p>
              <p className="text-sm text-muted-foreground">Full Access</p>
            </div>
            <div className="rounded-xl border bg-muted/40 p-4">
              <p className="font-semibold">Accountant</p>
              <p className="text-sm text-muted-foreground">Accounting Access</p>
            </div>
            <div className="rounded-xl border bg-muted/40 p-4">
              <p className="font-semibold">Staff</p>
              <p className="text-sm text-muted-foreground">Transaction Only</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
