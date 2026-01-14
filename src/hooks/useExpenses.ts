import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Expense, PaymentMethod } from '@/types/expense';
import { toast } from '@/hooks/use-toast';

interface DbExpense {
  id: string;
  date: string;
  description: string;
  amount: number;
  category_id: string | null;
  payment_method: string;
  is_installment: boolean;
  total_installments: number | null;
  installment_number: number | null;
  parent_expense_id: string | null;
  notes: string | null;
  created_at: string;
  is_recurring: boolean;
  recurring_due_day: number | null;
  recurring_parent_id: string | null;
}

function mapDbToExpense(db: DbExpense): Expense {
  return {
    id: db.id,
    date: db.date,
    description: db.description,
    amount: Number(db.amount),
    categoryId: db.category_id || '',
    paymentMethod: db.payment_method as PaymentMethod,
    isInstallment: db.is_installment || false,
    totalInstallments: db.total_installments || undefined,
    installmentNumber: db.installment_number || undefined,
    parentExpenseId: db.parent_expense_id || undefined,
    notes: db.notes || undefined,
    createdAt: db.created_at,
    isRecurring: db.is_recurring || false,
    recurringDueDay: db.recurring_due_day || undefined,
    recurringParentId: db.recurring_parent_id || undefined,
  };
}

export function useExpenses(month: string) {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [allExpenses, setAllExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchExpenses = useCallback(async () => {
    if (!user) {
      setExpenses([]);
      setAllExpenses([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch all expenses for calculations and recurring parents
      const { data: allData, error: allError } = await supabase
        .from('expenses')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

      if (allError) throw allError;

      const mappedAll = (allData || []).map(mapDbToExpense);
      setAllExpenses(mappedAll);

      // Filter for current month
      const monthExpenses = mappedAll.filter(e => e.date.startsWith(month));
      setExpenses(monthExpenses);
    } catch (err) {
      console.error('Error fetching expenses:', err);
      setError('Erro ao carregar despesas');
    } finally {
      setLoading(false);
    }
  }, [user, month]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  const addExpense = useCallback(async (expense: Omit<Expense, 'id' | 'createdAt'>) => {
    if (!user) return null;

    try {
      const { data, error: insertError } = await supabase
        .from('expenses')
        .insert({
          user_id: user.id,
          date: expense.date,
          description: expense.description,
          amount: expense.amount,
          category_id: expense.categoryId || null,
          payment_method: expense.paymentMethod,
          is_installment: expense.isInstallment,
          total_installments: expense.totalInstallments || null,
          installment_number: expense.installmentNumber || null,
          parent_expense_id: expense.parentExpenseId || null,
          notes: expense.notes || null,
          is_recurring: expense.isRecurring || false,
          recurring_due_day: expense.recurringDueDay || null,
          recurring_parent_id: expense.recurringParentId || null,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      const newExpense = mapDbToExpense(data);
      setExpenses(prev => [newExpense, ...prev]);
      setAllExpenses(prev => [newExpense, ...prev]);

      toast({
        title: 'Gasto registrado',
        description: `${expense.description} adicionado com sucesso.`,
      });

      return newExpense;
    } catch (err) {
      console.error('Error adding expense:', err);
      toast({
        title: 'Erro',
        description: 'Não foi possível adicionar o gasto.',
        variant: 'destructive',
      });
      return null;
    }
  }, [user]);

  const updateExpense = useCallback(async (expense: Expense) => {
    if (!user) return false;

    try {
      const { error: updateError } = await supabase
        .from('expenses')
        .update({
          date: expense.date,
          description: expense.description,
          amount: expense.amount,
          category_id: expense.categoryId || null,
          payment_method: expense.paymentMethod,
          notes: expense.notes || null,
        })
        .eq('id', expense.id)
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      setExpenses(prev => prev.map(e => e.id === expense.id ? expense : e));
      setAllExpenses(prev => prev.map(e => e.id === expense.id ? expense : e));

      return true;
    } catch (err) {
      console.error('Error updating expense:', err);
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar o gasto.',
        variant: 'destructive',
      });
      return false;
    }
  }, [user]);

  const deleteExpense = useCallback(async (id: string) => {
    if (!user) return false;

    try {
      // Also delete related installments
      await supabase
        .from('installments')
        .delete()
        .eq('expense_id', id);

      const { error: deleteError } = await supabase
        .from('expenses')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (deleteError) throw deleteError;

      setExpenses(prev => prev.filter(e => e.id !== id));
      setAllExpenses(prev => prev.filter(e => e.id !== id));

      toast({
        title: 'Gasto removido',
        description: 'O lançamento foi excluído.',
      });

      return true;
    } catch (err) {
      console.error('Error deleting expense:', err);
      toast({
        title: 'Erro',
        description: 'Não foi possível remover o gasto.',
        variant: 'destructive',
      });
      return false;
    }
  }, [user]);

  return {
    expenses,
    allExpenses,
    loading,
    error,
    refetch: fetchExpenses,
    addExpense,
    updateExpense,
    deleteExpense,
  };
}
