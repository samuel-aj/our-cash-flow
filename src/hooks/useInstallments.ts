import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Installment } from '@/types/expense';
import { calculateInstallments } from '@/lib/finance-utils';

interface DbInstallment {
  id: string;
  expense_id: string;
  due_month: string;
  installment_index: number;
  amount: number;
  paid: boolean;
}

function mapDbToInstallment(db: DbInstallment): Installment {
  return {
    id: db.id,
    expenseId: db.expense_id,
    dueMonth: db.due_month,
    installmentIndex: db.installment_index,
    amount: Number(db.amount),
    paid: db.paid || false,
  };
}

export function useInstallments() {
  const { user } = useAuth();
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInstallments = useCallback(async () => {
    if (!user) {
      setInstallments([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch installments via expenses join (RLS is on expense)
      const { data, error: fetchError } = await supabase
        .from('installments')
        .select(`
          *,
          expenses!inner(user_id)
        `)
        .eq('expenses.user_id', user.id)
        .order('due_month', { ascending: true });

      if (fetchError) throw fetchError;

      const mapped = (data || []).map((d: any) => mapDbToInstallment(d));
      setInstallments(mapped);
    } catch (err) {
      console.error('Error fetching installments:', err);
      setError('Erro ao carregar parcelas');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchInstallments();
  }, [fetchInstallments]);

  const createInstallments = useCallback(async (
    expenseId: string,
    totalAmount: number,
    totalInstallments: number,
    startMonth: string
  ) => {
    if (!user) return false;

    try {
      const installmentAmounts = calculateInstallments(totalAmount, totalInstallments, startMonth);

      const installmentsToInsert = installmentAmounts.map(inst => ({
        expense_id: expenseId,
        due_month: inst.month,
        installment_index: inst.index,
        amount: inst.amount,
        paid: false,
      }));

      const { error: insertError } = await supabase
        .from('installments')
        .insert(installmentsToInsert);

      if (insertError) throw insertError;

      await fetchInstallments();
      return true;
    } catch (err) {
      console.error('Error creating installments:', err);
      return false;
    }
  }, [user, fetchInstallments]);

  const markAsPaid = useCallback(async (installmentId: string, paid: boolean) => {
    if (!user) return false;

    try {
      const { error: updateError } = await supabase
        .from('installments')
        .update({ paid })
        .eq('id', installmentId);

      if (updateError) throw updateError;

      setInstallments(prev => 
        prev.map(i => i.id === installmentId ? { ...i, paid } : i)
      );

      return true;
    } catch (err) {
      console.error('Error updating installment:', err);
      return false;
    }
  }, [user]);

  return {
    installments,
    loading,
    error,
    refetch: fetchInstallments,
    createInstallments,
    markAsPaid,
  };
}
