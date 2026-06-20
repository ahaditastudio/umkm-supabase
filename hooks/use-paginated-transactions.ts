import { useState, useEffect, useCallback, useRef } from 'react';
import { getTransactionsPaginated, type TransactionCursor } from '@/lib/supabase/company-service';
import type { Transaction } from '@/lib/types';

export function usePaginatedTransactions(companyId: string, filters: {
  search?: string;
  type?: string;
  accountId?: string;
  year?: number;
}) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const cursorRef = useRef<TransactionCursor | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const loadingRef = useRef(false);

  const fetchPage = useCallback(async (
    cursor: TransactionCursor | null,
    append: boolean
  ) => {
    if (!companyId || loadingRef.current) return;

    loadingRef.current = true;
    setLoading(true);

    try {
      const result = await getTransactionsPaginated(companyId, cursor, 50, filters);
      setTransactions(append ? prev => [...prev, ...result.transactions] : result.transactions);
      cursorRef.current = result.nextCursor;
      setHasMore(result.hasMore);
    } catch (error) {
      console.error('Error loading transactions:', error);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [companyId, filters]);

  const fetchNextPage = useCallback(() => {
    if (!loadingRef.current) {
      fetchPage(cursorRef.current, true);
    }
  }, [fetchPage]);

  const refresh = useCallback(() => {
    cursorRef.current = null;
    setHasMore(true);
    fetchPage(null, false);
  }, [fetchPage]);

  // Reset and reload when filters change
  useEffect(() => {
    refresh();
  }, [companyId, filters.search, filters.type, filters.accountId, filters.year]);

  return { transactions, loading, hasMore, fetchNextPage, refresh };
}
