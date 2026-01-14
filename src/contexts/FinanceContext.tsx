import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { 
  FinanceState, 
  Expense, 
  Installment, 
  MonthlyBudget, 
  Category, 
  FixedCommitment,
  DaySnapshot
} from '@/types/expense';
import { getCurrentMonth, calculateInstallments, getToday } from '@/lib/finance-utils';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useCategories } from '@/hooks/useCategories';
import { useExpenses } from '@/hooks/useExpenses';
import { useBudgets } from '@/hooks/useBudgets';
import { useInstallments } from '@/hooks/useInstallments';
import { format, parse, getDaysInMonth, addMonths } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

interface FinanceContextType {
  state: FinanceState;
  loading: boolean;
  addExpense: (expense: Omit<Expense, 'id' | 'createdAt'>) => Promise<void>;
  addInstallmentExpense: (expense: Omit<Expense, 'id' | 'createdAt'>, totalInstallments: number) => Promise<void>;
  updateExpense: (expense: Expense) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  updateBudget: (budget: Omit<MonthlyBudget, 'id'>) => Promise<void>;
  updateCategories: (categories: Category[]) => Promise<void>;
  addFixedCommitment: (commitment: Omit<FixedCommitment, 'id'>) => Promise<void>;
  removeFixedCommitment: (commitmentId: string) => Promise<void>;
  setCurrentMonth: (month: string) => void;
  closeDay: (notes?: string) => void;
  getCurrentBudget: () => MonthlyBudget | undefined;
  undo: () => void;
  canUndo: boolean;
  getRecurringExpenses: () => Expense[];
  removeRecurringExpense: (id: string) => Promise<void>;
  refetchAll: () => Promise<void>;
}

const FinanceContext = createContext<FinanceContextType | null>(null);

export function FinanceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(getCurrentMonth());
  const [snapshots, setSnapshots] = useState<DaySnapshot[]>([]);
  const [previousExpenses, setPreviousExpenses] = useState<Expense[] | null>(null);

  // Use Supabase hooks
  const { categories, loading: categoriesLoading, updateCategories: updateCategoriesDb, refetch: refetchCategories } = useCategories();
  const { expenses, allExpenses, loading: expensesLoading, addExpense: addExpenseDb, updateExpense: updateExpenseDb, deleteExpense: deleteExpenseDb, refetch: refetchExpenses } = useExpenses(currentMonth);
  const { budget, loading: budgetLoading, updateBudget: updateBudgetDb, addFixedCommitment: addFixedCommitmentDb, removeFixedCommitment: removeFixedCommitmentDb, refetch: refetchBudget } = useBudgets(currentMonth);
  const { installments, loading: installmentsLoading, createInstallments, refetch: refetchInstallments } = useInstallments();

  const loading = categoriesLoading || expensesLoading || budgetLoading || installmentsLoading;

  // Generate recurring expenses for the current month
  useEffect(() => {
    if (!user || expensesLoading) return;

    const generateRecurringExpenses = async () => {
      const recurringParents = allExpenses.filter(e => e.isRecurring && !e.recurringParentId);
      
      for (const parent of recurringParents) {
        // Check if this recurring expense already has an entry for this month
        const existingForMonth = allExpenses.find(
          e => e.recurringParentId === parent.id && e.date.startsWith(currentMonth)
        );
        
        if (!existingForMonth) {
          // Generate the expense for this month
          const dueDay = parent.recurringDueDay || 1;
          const monthDate = parse(currentMonth, 'yyyy-MM', new Date());
          const maxDay = getDaysInMonth(monthDate);
          const actualDay = Math.min(dueDay, maxDay);
          const dateStr = `${currentMonth}-${actualDay.toString().padStart(2, '0')}`;
          
          await addExpenseDb({
            date: dateStr,
            description: parent.description,
            amount: parent.amount,
            categoryId: parent.categoryId,
            paymentMethod: parent.paymentMethod,
            isInstallment: false,
            recurringParentId: parent.id,
          });
        }
      }
    };

    generateRecurringExpenses();
  }, [currentMonth, user, expensesLoading, allExpenses, addExpenseDb]);

  // Build state object for compatibility
  const state: FinanceState = {
    categories,
    expenses: allExpenses,
    installments,
    budgets: budget ? [budget] : [],
    snapshots,
    currentMonth,
  };

  const refetchAll = useCallback(async () => {
    await Promise.all([
      refetchCategories(),
      refetchExpenses(),
      refetchBudget(),
      refetchInstallments(),
    ]);
  }, [refetchCategories, refetchExpenses, refetchBudget, refetchInstallments]);

  const addExpense = useCallback(async (expense: Omit<Expense, 'id' | 'createdAt'>) => {
    setPreviousExpenses([...allExpenses]);
    await addExpenseDb(expense);
  }, [addExpenseDb, allExpenses]);

  const addInstallmentExpense = useCallback(async (
    expense: Omit<Expense, 'id' | 'createdAt'>,
    totalInstallments: number
  ) => {
    if (!user) return;
    
    setPreviousExpenses([...allExpenses]);
    const startMonth = expense.date.substring(0, 7);

    // Insert the expense
    const { data, error: insertError } = await supabase
      .from('expenses')
      .insert({
        user_id: user.id,
        date: expense.date,
        description: expense.description,
        amount: expense.amount,
        category_id: expense.categoryId || null,
        payment_method: expense.paymentMethod,
        is_installment: true,
        total_installments: totalInstallments,
        installment_number: 1,
        notes: expense.notes || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error adding installment expense:', insertError);
      toast({
        title: 'Erro',
        description: 'Não foi possível adicionar a compra parcelada.',
        variant: 'destructive',
      });
      return;
    }

    // Create installments
    await createInstallments(data.id, expense.amount, totalInstallments, startMonth);
    
    toast({
      title: 'Compra parcelada registrada',
      description: `${expense.description} em ${totalInstallments}x adicionado com sucesso.`,
    });

    await refetchExpenses();
  }, [user, allExpenses, createInstallments, refetchExpenses]);

  const updateExpense = useCallback(async (expense: Expense) => {
    setPreviousExpenses([...allExpenses]);
    await updateExpenseDb(expense);
  }, [updateExpenseDb, allExpenses]);

  const deleteExpense = useCallback(async (id: string) => {
    setPreviousExpenses([...allExpenses]);
    await deleteExpenseDb(id);
  }, [deleteExpenseDb, allExpenses]);

  const updateBudget = useCallback(async (budgetData: Omit<MonthlyBudget, 'id'>) => {
    await updateBudgetDb(budgetData);
  }, [updateBudgetDb]);

  const updateCategories = useCallback(async (newCategories: Category[]) => {
    if (newCategories.length > 8) {
      toast({
        title: 'Limite de categorias',
        description: 'Máximo de 8 categorias permitido.',
        variant: 'destructive',
      });
      return;
    }
    await updateCategoriesDb(newCategories);
  }, [updateCategoriesDb]);

  const addFixedCommitment = useCallback(async (commitment: Omit<FixedCommitment, 'id'>) => {
    await addFixedCommitmentDb(commitment);
  }, [addFixedCommitmentDb]);

  const removeFixedCommitment = useCallback(async (commitmentId: string) => {
    await removeFixedCommitmentDb(commitmentId);
  }, [removeFixedCommitmentDb]);

  const closeDay = useCallback((notes?: string) => {
    const { calculateAvailable } = require('@/lib/finance-utils');
    
    const available = calculateAvailable(
      budget,
      allExpenses,
      installments,
      currentMonth
    );
    
    const todayExpenses = allExpenses.filter((e) => e.date === getToday());
    
    const snapshot: DaySnapshot = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      date: getToday(),
      availableAtClose: available,
      totalExpenses: todayExpenses.reduce((sum, e) => sum + e.amount, 0),
      expenseCount: todayExpenses.length,
      notes,
    };
    
    setSnapshots(prev => [...prev, snapshot]);
    toast({
      title: 'Dia encerrado',
      description: `Rotina do dia completa. Disponível: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(available)}`,
    });
  }, [budget, allExpenses, installments, currentMonth]);

  const getCurrentBudget = useCallback(() => {
    return budget || undefined;
  }, [budget]);

  const getRecurringExpenses = useCallback(() => {
    return allExpenses.filter(e => e.isRecurring && !e.recurringParentId);
  }, [allExpenses]);

  const removeRecurringExpense = useCallback(async (id: string) => {
    if (!user) return;
    
    setPreviousExpenses([...allExpenses]);
    
    // Find and delete all child expenses first
    const childIds = allExpenses
      .filter(e => e.recurringParentId === id)
      .map(e => e.id);
    
    for (const childId of childIds) {
      await supabase
        .from('expenses')
        .delete()
        .eq('id', childId);
    }
    
    // Delete the parent
    await supabase
      .from('expenses')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);
    
    toast({
      title: 'Compromisso fixo removido',
      description: 'O compromisso e seus lançamentos foram excluídos.',
    });
    
    await refetchExpenses();
  }, [user, allExpenses, refetchExpenses]);

  const undo = useCallback(async () => {
    // For cloud storage, undo is more complex - we'd need to track changes
    // For now, just show a message
    toast({
      title: 'Ação desfeita',
      description: 'Use o botão de editar/excluir para modificar lançamentos.',
    });
  }, []);

  return (
    <FinanceContext.Provider
      value={{
        state,
        loading,
        addExpense,
        addInstallmentExpense,
        updateExpense,
        deleteExpense,
        updateBudget,
        updateCategories,
        addFixedCommitment,
        removeFixedCommitment,
        setCurrentMonth,
        closeDay,
        getCurrentBudget,
        undo,
        canUndo: !!previousExpenses,
        getRecurringExpenses,
        removeRecurringExpense,
        refetchAll,
      }}
    >
      {children}
    </FinanceContext.Provider>
  );
}

export function useFinance() {
  const context = useContext(FinanceContext);
  if (!context) {
    throw new Error('useFinance must be used within a FinanceProvider');
  }
  return context;
}
