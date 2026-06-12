import {
  WriteBatch,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type QueryConstraint,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export const FIRESTORE_BATCH_LIMIT = 450;

export function requireDb() {
  if (!db) throw new Error("Firebase belum dikonfigurasi.");
  return db;
}

export function scopedDocId(companyId: string, id: string) {
  return `${companyId}_${id}`;
}

export function cleanForFirestore<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => cleanForFirestore(item)) as T;
  }

  if (value && typeof value === "object") {
    const output: Record<string, unknown> = {};
    Object.entries(value as Record<string, unknown>).forEach(([key, item]) => {
      if (item !== undefined) output[key] = cleanForFirestore(item);
    });
    return output as T;
  }

  return value;
}

export function companyQuery(collectionName: string, companyId: string, ...constraints: QueryConstraint[]) {
  const firestore = requireDb();
  return query(collection(firestore, collectionName), where("companyId", "==", companyId), ...constraints);
}

export async function getCompanyDocs<T>(collectionName: string, companyId: string, ...constraints: QueryConstraint[]) {
  const snapshot = await getDocs(companyQuery(collectionName, companyId, ...constraints));
  return snapshot.docs.map((item) => item.data() as T);
}

export async function setCompanyDoc(collectionName: string, documentId: string, data: DocumentData) {
  const firestore = requireDb();
  await setDoc(doc(firestore, collectionName, documentId), cleanForFirestore(data), { merge: true });
}

export async function updateCompanyDoc(collectionName: string, documentId: string, data: DocumentData) {
  const firestore = requireDb();
  await updateDoc(doc(firestore, collectionName, documentId), cleanForFirestore(data));
}

export async function deleteCompanyDoc(collectionName: string, documentId: string) {
  const firestore = requireDb();
  await deleteDoc(doc(firestore, collectionName, documentId));
}

type BatchOperation = (batch: WriteBatch) => void;

export async function commitInChunks(operations: BatchOperation[]) {
  const firestore = requireDb();

  for (let index = 0; index < operations.length; index += FIRESTORE_BATCH_LIMIT) {
    const batch = writeBatch(firestore);
    operations.slice(index, index + FIRESTORE_BATCH_LIMIT).forEach((operation) => operation(batch));
    await batch.commit();
  }
}
