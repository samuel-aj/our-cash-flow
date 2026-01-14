import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { MonthlyBudget, FixedCommitment, CategoryBudget } from '@/types/expense';
import { toast } from '@/hooks/use-toast';

interface DbBudget {
  id: string;
  month: string;
  income: number | null;
  closed_at: string | null;
  notes: string | null;
}

interface DbFixedCommitment {
  id: string;
  budget_id: string;
  name: string;
  amount: number;
  due_day: number | null;
}

interface DbCategoryBudget {
  id: string;
  budget_id: string;
  category_id: string;
  planned_amount: number;
}

export function useBudgets(month: string) {
  const { user } = useAuth();
  const [budget, setBudget] = useState<MonthlyBudget | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBudget = useCallback(async () => {
    if (!user) {
      setBudget(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch budget for the month
      const { data: budgetData, error: budgetError } = await supabase
        .from('budgets')
        .select('*')
        .eq('user_id', user.id)
        .eq('month', month)
        .maybeSingle();

      if (budgetError) throw budgetError;

      if (!budgetData) {
        setBudget(null);
        setLoading(false);
        return;
      }

      // Fetch fixed commitments
      const { data: commitmentsData, error: commitmentsError } = await supabase
        .from('fixed_commitments')
        .select('*')
        .eq('budget_id', budgetData.id);

      if (commitmentsError) throw commitmentsError;

      // Fetch category budgets
      const { data: categoryBudgetsData, error: catBudgetError } = await supabase
        .from('category_budgets')
        .select('*')
        .eq('budget_id', budgetData.id);

      if (catBudgetError) throw catBudgetError;

      const mappedBudget: MonthlyBudget = {
        id: budgetData.id,
        month: budgetData.month,
        income: Number(budgetData.income) || 0,
        fixedCommitments: (commitmentsData || []).map((c: DbFixedCommitment) => ({
          id: c.id,
          name: c.name,
          amount: Number(c.amount),
          dueDay: c.due_day || undefined,
        })),
        categoryBudgets: (categoryBudgetsData || []).map((cb: DbCategoryBudget) => ({
          categoryId: cb.category_id,
          plannedAmount: Number(cb.planned_amount),
        })),
        closedAt: budgetData.closed_at || undefined,
        notes: budgetData.notes || undefined,
      };

      setBudget(mappedBudget);
    } catch (err) {
      console.error('Error fetching budget:', err);
      setError('Erro ao carregar orçamento');
    } finally {
      setLoading(false);
    }
  }, [user, month]);

  useEffect(() => {
    fetchBudget();
  }, [fetchBudget]);

  const updateBudget = useCallback(async (budgetData: Omit<MonthlyBudget, 'id'>) => {
    if (!user) return null;

    try {
      // Check if budget exists
      const { data: existing } = await supabase
        .from('budgets')
        .select('id')
        .eq('user_id', user.id)
        .eq('month', budgetData.month)
        .maybeSingle();

      let budgetId: string;

      if (existing) {
        // Update existing budget
        const { error: updateError } = await supabase
          .from('budgets')
          .update({
            income: budgetData.income,
            notes: budgetData.notes || null,
          })
          .eq('id', existing.id);

        if (updateError) throw updateError;
        budgetId = existing.id;
      } else {
        // Create new budget
        const { data: newBudget, error: insertError } = await supabase
          .from('budgets')
          .insert({
            user_id: user.id,
            month: budgetData.month,
            income: budgetData.income,
            notes: budgetData.notes || null,
          })
          .select()
          .single();

        if (insertError) throw insertError;
        budgetId = newBudget.id;
      }

      // Update category budgets
      if (budgetData.categoryBudgets && budgetData.categoryBudgets.length > 0) {
        // Delete existing category budgets
        await supabase
          .from('category_budgets')
          .delete()
          .eq('budget_id', budgetId);

        // Insert new category budgets
        const categoryBudgetsToInsert = budgetData.categoryBudgets.map(cb => ({
          budget_id: budgetId,
          category_id: cb.categoryId,
          planned_amount: cb.plannedAmount,
        }));

        await supabase
          .from('category_budgets')
          .insert(categoryBudgetsToInsert);
      }

      toast({
        title: 'Orçamento atualizado',
        description: 'As configurações do mês foram salvas.',
      });

      await fetchBudget();
      return budgetId;
    } catch (err) {
      console.error('Error updating budget:', err);
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar o orçamento.',
        variant: 'destructive',
      });
      return null;
    }
  }, [user, fetchBudget]);

  const addFixedCommitment = useCallback(async (commitment: Omit<FixedCommitment, 'id'>) => {
    if (!user) return null;

    try {
      let budgetId = budget?.id;

      // Create budget if it doesn't exist
      if (!budgetId) {
        const { data: newBudget, error: insertError } = await supabase
          .from('budgets')
          .insert({
            user_id: user.id,
            month: month,
            income: 0,
          })
          .select()
          .single();

        if (insertError) throw insertError;
        budgetId = newBudget.id;
      }

      const { data, error: commitmentError } = await supabase
        .from('fixed_commitments')
        .insert({
          budget_id: budgetId,
          name: commitment.name,
          amount: commitment.amount,
          due_day: commitment.dueDay || null,
        })
        .select()
        .single();

      if (commitmentError) throw commitmentError;

      await fetchBudget();
      return data.id;
    } catch (err) {
      console.error('Error adding fixed commitment:', err);
      toast({
        title: 'Erro',
        description: 'Não foi possível adicionar o compromisso.',
        variant: 'destructive',
      });
      return null;
    }
  }, [user, budget, month, fetchBudget]);

  const removeFixedCommitment = useCallback(async (commitmentId: string) => {
    if (!user) return false;

    try {
      const { error: deleteError } = await supabase
        .from('fixed_commitments')
        .delete()
        .eq('id', commitmentId);

      if (deleteError) throw deleteError;

      await fetchBudget();
      return true;
    } catch (err) {
      console.error('Error removing fixed commitment:', err);
      toast({
        title: 'Erro',
        description: 'Não foi possível remover o compromisso.',
        variant: 'destructive',
      });
      return false;
    }
  }, [user, fetchBudget]);

  return {
    budget,
    loading,
    error,
    refetch: fetchBudget,
    updateBudget,
    addFixedCommitment,
    removeFixedCommitment,
  };
}
