"use client";

import { Loader2, Lock, PlusCircle } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
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
import { accountLabel, getAccount } from "@/lib/accounting";
import {
  addAccountFirestore,
  addAccountingPeriodFirestore,
  closeCurrentPeriodFirestore,
  createOpeningBalanceFirestore,
} from "@/lib/firestore/company-service";
import type { AccountType, NormalBalance } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useKasFlowStore } from "@/store/use-kasflow-store";

export default function AccountingPage() {
  const { appUser } = useAuth();
  const accounts = useKasFlowStore((state) => state.accounts);
  const journalEntries = useKasFlowStore((state) => state.journalEntries);
  const ledgerEntries = useKasFlowStore((state) => state.ledgerEntries);
  const accountingPeriods = useKasFlowStore((state) => state.accountingPeriods);
  const auditLogs = useKasFlowStore((state) => state.auditLogs);
  const createOpeningBalance = useKasFlowStore(
    (state) => state.createOpeningBalance,
  );
  const closeCurrentPeriod = useKasFlowStore(
    (state) => state.closeCurrentPeriod,
  );
  const addAccount = useKasFlowStore((state) => state.addAccount);
  const addAccountingPeriod = useKasFlowStore(
    (state) => state.addAccountingPeriod,
  );

  // Opening balance state
  const [selectedAccountId, setSelectedAccountId] = useState("1110");
  const [openingAmount, setOpeningAmount] = useState(0);
  const [openingSide, setOpeningSide] = useState<"debit" | "credit">("debit");

  // Closing state
  const [confirmation, setConfirmation] = useState("");

  // Add account (COA) state
  const [newAccountCode, setNewAccountCode] = useState("");
  const [newAccountName, setNewAccountName] = useState("");
  const [newAccountType, setNewAccountType] = useState<AccountType>("asset");
  const [newAccountNormalBalance, setNewAccountNormalBalance] =
    useState<NormalBalance>("debit");
  const [addAccountLoading, setAddAccountLoading] = useState(false);

  // Add accounting period state
  const [periodStartDate, setPeriodStartDate] = useState("");
  const [periodEndDate, setPeriodEndDate] = useState("");
  const [addPeriodLoading, setAddPeriodLoading] = useState(false);

  // Shared message
  const [message, setMessage] = useState<string | null>(null);

  const selectedLedger = useMemo(
    () =>
      ledgerEntries.filter((entry) => entry.accountId === selectedAccountId),
    [ledgerEntries, selectedAccountId],
  );
  const currentPeriod = accountingPeriods[0];

  const handleOpeningBalance = async () => {
    if (!openingAmount) return setMessage("Nominal saldo awal wajib diisi.");
    if (appUser) {
      await createOpeningBalanceFirestore(
        appUser.companyId,
        selectedAccountId,
        openingAmount,
        openingSide,
      );
    } else {
      createOpeningBalance(selectedAccountId, openingAmount, openingSide);
    }
    setMessage("Saldo awal berhasil dibuat sebagai jurnal otomatis.");
    setOpeningAmount(0);
  };

  const handleClosing = async () => {
    try {
      if (confirmation !== "TUTUP BUKU") {
        throw new Error("Konfirmasi harus mengetik TUTUP BUKU.");
      }
      if (appUser) {
        await closeCurrentPeriodFirestore(
          appUser.companyId,
          currentPeriod.id,
          currentPeriod.startDate,
          currentPeriod.endDate,
        );
      } else {
        closeCurrentPeriod(confirmation);
      }
      setMessage(
        "Periode ditutup. Transaksi dan jurnal dalam periode ini terkunci.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal tutup buku.");
    }
  };

  const handleAddAccount = async (event: FormEvent) => {
    event.preventDefault();
    if (!newAccountCode.trim() || !newAccountName.trim()) {
      setMessage("Kode dan nama akun wajib diisi.");
      return;
    }
    setAddAccountLoading(true);
    setMessage(null);
    try {
      if (appUser) {
        await addAccountFirestore(
          appUser.companyId,
          newAccountCode.trim(),
          newAccountName.trim(),
          newAccountType,
          newAccountNormalBalance,
        );
      }
      addAccount(
        newAccountCode.trim(),
        newAccountName.trim(),
        newAccountType,
        newAccountNormalBalance,
      );
      setNewAccountCode("");
      setNewAccountName("");
      setMessage(`Akun ${newAccountCode.trim()} berhasil ditambahkan ke COA.`);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Gagal menambah akun.",
      );
    } finally {
      setAddAccountLoading(false);
    }
  };

  const handleAddPeriod = async (event: FormEvent) => {
    event.preventDefault();
    if (!periodStartDate || !periodEndDate) {
      setMessage("Tanggal mulai dan akhir periode wajib diisi.");
      return;
    }
    if (periodStartDate >= periodEndDate) {
      setMessage("Tanggal mulai harus lebih awal dari tanggal akhir.");
      return;
    }
    setAddPeriodLoading(true);
    setMessage(null);
    try {
      if (appUser) {
        await addAccountingPeriodFirestore(
          appUser.companyId,
          periodStartDate,
          periodEndDate,
        );
      }
      addAccountingPeriod(periodStartDate, periodEndDate);
      setPeriodStartDate("");
      setPeriodEndDate("");
      setMessage("Periode akuntansi baru berhasil dibuat.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Gagal membuat periode.",
      );
    } finally {
      setAddPeriodLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <Badge tone="blue">Accounting Module</Badge>
        <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
          Akuntansi
        </h2>
        <p className="mt-1 text-muted-foreground">
          General journal, ledger per account, COA, opening balance, closing,
          dan audit log.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Accounting Period</CardTitle>
            <CardDescription>
              Closed periods tidak dapat diedit.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl bg-muted p-4 text-sm">
              <p>
                <span className="text-muted-foreground">Start:</span>{" "}
                {formatDate(currentPeriod.startDate)}
              </p>
              <p>
                <span className="text-muted-foreground">End:</span>{" "}
                {formatDate(currentPeriod.endDate)}
              </p>
              <p className="mt-2">
                <Badge tone={currentPeriod.status === "open" ? "green" : "red"}>
                  {currentPeriod.status}
                </Badge>
              </p>
            </div>
            <Label>Konfirmasi tutup buku</Label>
            <Input
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              placeholder="Ketik TUTUP BUKU"
            />
            <Button
              className="w-full"
              variant="destructive"
              onClick={handleClosing}
              disabled={currentPeriod.status === "closed"}
            >
              <Lock className="h-4 w-4" /> Tutup Buku
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Opening Balance</CardTitle>
            <CardDescription>
              Generate opening journal otomatis.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label>Akun</Label>
              <Select
                value={selectedAccountId}
                onChange={(event) => setSelectedAccountId(event.target.value)}
              >
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {accountLabel(account)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Debit/Credit</Label>
              <Select
                value={openingSide}
                onChange={(event) =>
                  setOpeningSide(event.target.value as "debit" | "credit")
                }
              >
                <option value="debit">Debit</option>
                <option value="credit">Credit</option>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Balance</Label>
              <Input
                type="number"
                value={openingAmount || ""}
                onChange={(event) =>
                  setOpeningAmount(Number(event.target.value))
                }
              />
            </div>
            <Button className="w-full" onClick={handleOpeningBalance}>
              <PlusCircle className="h-4 w-4" /> Buat Saldo Awal
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Audit Log</CardTitle>
            <CardDescription>
              Track create, update, delete, export, reset.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {auditLogs.slice(0, 5).map((log) => (
              <div key={log.id} className="rounded-xl bg-muted p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <Badge tone="muted">{log.action}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(log.timestamp)}
                  </span>
                </div>
                <p className="mt-2 font-medium">{log.module}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {message ? (
        <p className="rounded-xl border bg-card px-4 py-3 text-sm">{message}</p>
      ) : null}

      {/* ── Tambah Akun COA + Buat Periode Akuntansi ── */}
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Tambah Akun COA</CardTitle>
            <CardDescription>
              Tambah akun baru ke Chart of Accounts.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddAccount} className="space-y-4">
              <div className="grid gap-2">
                <Label>Kode Akun</Label>
                <Input
                  value={newAccountCode}
                  onChange={(e) => setNewAccountCode(e.target.value)}
                  placeholder="Contoh: 1500"
                />
              </div>
              <div className="grid gap-2">
                <Label>Nama Akun</Label>
                <Input
                  value={newAccountName}
                  onChange={(e) => setNewAccountName(e.target.value)}
                  placeholder="Contoh: Piutang Usaha"
                />
              </div>
              <div className="grid gap-2">
                <Label>Tipe</Label>
                <Select
                  value={newAccountType}
                  onChange={(e) =>
                    setNewAccountType(e.target.value as AccountType)
                  }
                >
                  <option value="asset">Asset</option>
                  <option value="liability">Liability</option>
                  <option value="equity">Equity</option>
                  <option value="revenue">Revenue</option>
                  <option value="expense">Expense</option>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Normal Balance</Label>
                <Select
                  value={newAccountNormalBalance}
                  onChange={(e) =>
                    setNewAccountNormalBalance(e.target.value as NormalBalance)
                  }
                >
                  <option value="debit">Debit</option>
                  <option value="credit">Credit</option>
                </Select>
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={addAccountLoading}
              >
                {addAccountLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <PlusCircle className="h-4 w-4" />
                )}
                Tambah Akun
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Buat Periode Akuntansi Baru</CardTitle>
            <CardDescription>
              Buat periode baru setelah periode aktif ditutup.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleAddPeriod} className="space-y-4">
              <div className="grid gap-2">
                <Label>Tanggal Mulai</Label>
                <Input
                  type="date"
                  value={periodStartDate}
                  onChange={(e) => setPeriodStartDate(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>Tanggal Akhir</Label>
                <Input
                  type="date"
                  value={periodEndDate}
                  onChange={(e) => setPeriodEndDate(e.target.value)}
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={addPeriodLoading}
              >
                {addPeriodLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <PlusCircle className="h-4 w-4" />
                )}
                Buat Periode
              </Button>
            </form>

            {accountingPeriods.length > 0 ? (
              <div className="space-y-2 pt-2">
                <p className="text-sm font-medium text-muted-foreground">
                  Semua Periode
                </p>
                <div className="max-h-48 space-y-2 overflow-auto scrollbar-thin">
                  {accountingPeriods.map((period) => (
                    <div
                      key={period.id}
                      className="flex items-center justify-between rounded-xl bg-muted px-4 py-3 text-sm"
                    >
                      <div>
                        <p className="font-medium">
                          {formatDate(period.startDate)} —{" "}
                          {formatDate(period.endDate)}
                        </p>
                      </div>
                      <Badge tone={period.status === "open" ? "green" : "red"}>
                        {period.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {/* ── General Journal + Ledger ── */}
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>General Journal</CardTitle>
            <CardDescription>
              Source of truth untuk laporan keuangan.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-[520px] overflow-auto scrollbar-thin">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-3 pr-4">Tanggal</th>
                    <th className="py-3 pr-4">Deskripsi</th>
                    <th className="py-3 pr-4">Akun</th>
                    <th className="py-3 pr-4 text-right">Debit</th>
                    <th className="py-3 pr-4 text-right">Credit</th>
                    <th className="py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {journalEntries.flatMap((journal) =>
                    journal.lines.map((line, index) => (
                      <tr
                        key={`${journal.id}_${index}`}
                        className="border-b last:border-0"
                      >
                        <td className="py-3 pr-4">
                          {formatDate(journal.date)}
                        </td>
                        <td className="py-3 pr-4">{journal.description}</td>
                        <td className="py-3 pr-4">
                          {getAccount(accounts, line.accountId)?.name ??
                            line.accountId}
                        </td>
                        <td className="py-3 pr-4 text-right">
                          {line.debit ? formatCurrency(line.debit) : "-"}
                        </td>
                        <td className="py-3 pr-4 text-right">
                          {line.credit ? formatCurrency(line.credit) : "-"}
                        </td>
                        <td className="py-3">
                          <Badge
                            tone={journal.status === "locked" ? "red" : "green"}
                          >
                            {journal.status}
                          </Badge>
                        </td>
                      </tr>
                    )),
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ledger</CardTitle>
            <CardDescription>Running balance per account.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select
              value={selectedAccountId}
              onChange={(event) => setSelectedAccountId(event.target.value)}
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {accountLabel(account)}
                </option>
              ))}
            </Select>
            <div className="max-h-[460px] overflow-auto scrollbar-thin">
              <table className="w-full min-w-[620px] text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-3 pr-4">Tanggal</th>
                    <th className="py-3 pr-4">Deskripsi</th>
                    <th className="py-3 pr-4 text-right">Debit</th>
                    <th className="py-3 pr-4 text-right">Credit</th>
                    <th className="py-3 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedLedger.map((entry) => (
                    <tr key={entry.id} className="border-b last:border-0">
                      <td className="py-3 pr-4">{formatDate(entry.date)}</td>
                      <td className="py-3 pr-4">{entry.description}</td>
                      <td className="py-3 pr-4 text-right">
                        {entry.debit ? formatCurrency(entry.debit) : "-"}
                      </td>
                      <td className="py-3 pr-4 text-right">
                        {entry.credit ? formatCurrency(entry.credit) : "-"}
                      </td>
                      <td className="py-3 text-right font-semibold">
                        {formatCurrency(entry.balance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Chart of Accounts ── */}
      <Card>
        <CardHeader>
          <CardTitle>Chart of Accounts</CardTitle>
          <CardDescription>COA default sesuai PRD.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => (
            <div key={account.id} className="rounded-xl border bg-muted/40 p-3">
              <p className="font-semibold">
                {account.code} {account.name}
              </p>
              <p className="text-sm capitalize text-muted-foreground">
                {account.type} • normal {account.normalBalance}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
