import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface Income {
  id: string;
  month: string;
  description: string;
  amount: number;
  category_id: string | null;
  date: string;
  notes: string | null;
}

interface IncomeCategory {
  id: string;
  name: string;
  color_index: number;
}

interface UseMonthlyIncomesResult {
  incomes: Income[];
  categories: IncomeCategory[];
  totalIncome: number;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useMonthlyIncomes(month: string): UseMonthlyIncomesResult {
  const { user } = useAuth();
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [categories, setCategories] = useState<IncomeCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch incomes for the month
      const { data: incomeData, error: incomeError } = await supabase
        .from('incomes')
        .select('*')
        .eq('user_id', user.id)
        .eq('month', month)
        .order('date', { ascending: false });

      if (incomeError) throw incomeError;

      // Fetch categories
      const { data: catData, error: catError } = await supabase
        .from('income_categories')
        .select('*')
        .eq('user_id', user.id)
        .order('name');

      if (catError) throw catError;

      setIncomes(incomeData || []);
      setCategories(catData || []);
    } catch (err) {
      console.error('Error fetching incomes:', err);
      setError('Erro ao carregar receitas');
    } finally {
      setLoading(false);
    }
  }, [user, month]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalIncome = incomes.reduce((sum, inc) => sum + inc.amount, 0);

  return {
    incomes,
    categories,
    totalIncome,
    loading,
    error,
    refetch: fetchData,
  };
}
