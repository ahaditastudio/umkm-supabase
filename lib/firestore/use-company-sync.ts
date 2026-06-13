"use client";

import { doc, onSnapshot } from "firebase/firestore";
import { useEffect } from "react";
import { useAuth } from "@/components/auth-provider";
import { buildLedgerEntries, defaultTaxSettings } from "@/lib/accounting";
import { db } from "@/lib/firebase";
import { companyQuery } from "@/lib/firestore/helpers";
import type {
  Account,
  AccountingPeriod,
  AuditLog,
  BusinessProfile,
  CashAccount,
  Category,
  Customer,
  JournalEntry,
  Supplier,
  TaxSettings,
  Transaction,
} from "@/lib/types";
import { useKasFlowStore } from "@/store/use-kasflow-store";

function sortByDateDesc<
  T extends { date?: string; timestamp?: string; createdAt?: string },
>(items: T[]) {
  return items.sort((a, b) =>
    String(b.date ?? b.timestamp ?? b.createdAt ?? "").localeCompare(
      String(a.date ?? a.timestamp ?? a.createdAt ?? ""),
    ),
  );
}

function refreshLedger() {
  const state = useKasFlowStore.getState();
  useKasFlowStore.setState({
    ledgerEntries: buildLedgerEntries(state.journalEntries, state.accounts),
  });
}

function subscribeCompanyDocs<T>(
  collectionName: string,
  companyId: string,
  callback: (items: T[]) => void,
) {
  return onSnapshot(
    companyQuery(collectionName, companyId),
    (snapshot) =>
      callback(
        snapshot.docs.map((item) => {
          const data = item.data() as any;
          if (data && data.deletedAt === null) {
            data.deletedAt = undefined;
          }
          return data as T;
        }),
      ),
    (error) =>
      console.error(`Firestore sync error on ${collectionName}`, error),
  );
}

export function useCompanySync() {
  const { appUser } = useAuth();

  useEffect(() => {
    if (!appUser || !db) return;

    useKasFlowStore.setState({ companyId: appUser.companyId });

    const unsubscribers = [
      onSnapshot(
        doc(db, "business_profiles", appUser.companyId),
        (snapshot) => {
          if (snapshot.exists())
            useKasFlowStore.setState({
              profile: snapshot.data() as BusinessProfile,
            });
        },
        (error) =>
          console.error("Firestore sync error on business_profiles", error),
      ),
      subscribeCompanyDocs<Account>("accounts", appUser.companyId, (items) => {
        useKasFlowStore.setState({
          accounts: items.sort((a, b) => a.code.localeCompare(b.code)),
        });
        refreshLedger();
      }),
      subscribeCompanyDocs<Category>(
        "account_categories",
        appUser.companyId,
        (items) => {
          useKasFlowStore.setState({
            categories: items.sort((a, b) => a.name.localeCompare(b.name)),
          });
        },
      ),
      subscribeCompanyDocs<CashAccount>(
        "cash_accounts",
        appUser.companyId,
        (items) => {
          useKasFlowStore.setState({
            cashAccounts: items.sort((a, b) => a.name.localeCompare(b.name)),
          });
        },
      ),
      subscribeCompanyDocs<Customer>(
        "customers",
        appUser.companyId,
        (items) => {
          useKasFlowStore.setState({
            customers: items.sort((a, b) => a.name.localeCompare(b.name)),
          });
        },
      ),
      subscribeCompanyDocs<Supplier>(
        "suppliers",
        appUser.companyId,
        (items) => {
          useKasFlowStore.setState({
            suppliers: items.sort((a, b) => a.name.localeCompare(b.name)),
          });
        },
      ),
      subscribeCompanyDocs<Transaction>(
        "transactions",
        appUser.companyId,
        (items) => {
          useKasFlowStore.setState({ transactions: sortByDateDesc(items) });
        },
      ),
      subscribeCompanyDocs<JournalEntry>(
        "journal_entries",
        appUser.companyId,
        (items) => {
          useKasFlowStore.setState({ journalEntries: sortByDateDesc(items) });
          refreshLedger();
        },
      ),
      subscribeCompanyDocs<TaxSettings>(
        "tax_settings",
        appUser.companyId,
        (items) => {
          useKasFlowStore.setState({
            taxSettings: items[0] ?? {
              ...defaultTaxSettings,
              companyId: appUser.companyId,
            },
          });
        },
      ),
      subscribeCompanyDocs<AccountingPeriod>(
        "accounting_periods",
        appUser.companyId,
        (items) => {
          useKasFlowStore.setState({
            accountingPeriods: items.sort((a, b) =>
              b.startDate.localeCompare(a.startDate),
            ),
          });
        },
      ),
      subscribeCompanyDocs<AuditLog>(
        "audit_logs",
        appUser.companyId,
        (items) => {
          useKasFlowStore.setState({
            auditLogs: sortByDateDesc(items).slice(0, 100),
          });
        },
      ),
    ];

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [appUser]);
}
