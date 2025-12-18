import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { 
  FinanceState, 
  Expense, 
  Installment, 
  MonthlyBudget, 
  Category, 
  FixedCommitment,
  DEFAULT_CATEGORIES,
  DaySnapshot
} from '@/types/expense';
import { generateId, getCurrentMonth, calculateInstallments, getToday } from '@/lib/finance-utils';
import { toast } from '@/hooks/use-toast';
import { format, parse, getDaysInMonth } from 'date-fns';

const STORAGE_KEY = 'controle-gastos-data';

type Action =
  | { type: 'LOAD_DATA'; payload: FinanceState }
  | { type: 'SET_MONTH'; payload: string }
  | { type: 'ADD_EXPENSE'; payload: Expense }
  | { type: 'UPDATE_EXPENSE'; payload: Expense }
  | { type: 'DELETE_EXPENSE'; payload: string }
  | { type: 'ADD_INSTALLMENT_EXPENSE'; payload: { expense: Expense; installments: Installment[] } }
  | { type: 'UPDATE_BUDGET'; payload: MonthlyBudget }
  | { type: 'UPDATE_CATEGORIES'; payload: Category[] }
  | { type: 'ADD_FIXED_COMMITMENT'; payload: { month: string; commitment: FixedCommitment } }
  | { type: 'REMOVE_FIXED_COMMITMENT'; payload: { month: string; commitmentId: string } }
  | { type: 'CLOSE_DAY'; payload: DaySnapshot }
  | { type: 'UNDO_LAST'; payload: FinanceState };

const initialState: FinanceState = {
  categories: DEFAULT_CATEGORIES,
  expenses: [],
  installments: [],
  budgets: [],
  snapshots: [],
  currentMonth: getCurrentMonth(),
};

function reducer(state: FinanceState, action: Action): FinanceState {
  switch (action.type) {
    case 'LOAD_DATA':
      return action.payload;
      
    case 'SET_MONTH':
      return { ...state, currentMonth: action.payload };
      
    case 'ADD_EXPENSE':
      return { ...state, expenses: [...state.expenses, action.payload] };
      
    case 'UPDATE_EXPENSE':
      return {
        ...state,
        expenses: state.expenses.map((e) =>
          e.id === action.payload.id ? action.payload : e
        ),
      };
      
    case 'DELETE_EXPENSE': {
      const expenseToDelete = state.expenses.find((e) => e.id === action.payload);
      if (!expenseToDelete) return state;
      
      // Also delete related installments if it's an installment expense
      const newInstallments = expenseToDelete.isInstallment
        ? state.installments.filter((i) => i.expenseId !== action.payload)
        : state.installments;
        
      return {
        ...state,
        expenses: state.expenses.filter((e) => e.id !== action.payload),
        installments: newInstallments,
      };
    }
    
    case 'ADD_INSTALLMENT_EXPENSE':
      return {
        ...state,
        expenses: [...state.expenses, action.payload.expense],
        installments: [...state.installments, ...action.payload.installments],
      };
      
    case 'UPDATE_BUDGET': {
      const existingIndex = state.budgets.findIndex((b) => b.month === action.payload.month);
      if (existingIndex >= 0) {
        const newBudgets = [...state.budgets];
        newBudgets[existingIndex] = action.payload;
        return { ...state, budgets: newBudgets };
      }
      return { ...state, budgets: [...state.budgets, action.payload] };
    }
    
    case 'UPDATE_CATEGORIES':
      return { ...state, categories: action.payload };
      
    case 'ADD_FIXED_COMMITMENT': {
      const budget = state.budgets.find((b) => b.month === action.payload.month);
      if (!budget) {
        const newBudget: MonthlyBudget = {
          id: generateId(),
          month: action.payload.month,
          income: 0,
          fixedCommitments: [action.payload.commitment],
        };
        return { ...state, budgets: [...state.budgets, newBudget] };
      }
      return {
        ...state,
        budgets: state.budgets.map((b) =>
          b.month === action.payload.month
            ? { ...b, fixedCommitments: [...b.fixedCommitments, action.payload.commitment] }
            : b
        ),
      };
    }
    
    case 'REMOVE_FIXED_COMMITMENT':
      return {
        ...state,
        budgets: state.budgets.map((b) =>
          b.month === action.payload.month
            ? {
                ...b,
                fixedCommitments: b.fixedCommitments.filter(
                  (c) => c.id !== action.payload.commitmentId
                ),
              }
            : b
        ),
      };
      
    case 'CLOSE_DAY':
      return { ...state, snapshots: [...state.snapshots, action.payload] };
      
    case 'UNDO_LAST':
      return action.payload;
      
    default:
      return state;
  }
}

interface FinanceContextType {
  state: FinanceState;
  addExpense: (expense: Omit<Expense, 'id' | 'createdAt'>) => void;
  addInstallmentExpense: (expense: Omit<Expense, 'id' | 'createdAt'>, totalInstallments: number) => void;
  updateExpense: (expense: Expense) => void;
  deleteExpense: (id: string) => void;
  updateBudget: (budget: Omit<MonthlyBudget, 'id'>) => void;
  updateCategories: (categories: Category[]) => void;
  addFixedCommitment: (commitment: Omit<FixedCommitment, 'id'>) => void;
  removeFixedCommitment: (commitmentId: string) => void;
  setCurrentMonth: (month: string) => void;
  closeDay: (notes?: string) => void;
  getCurrentBudget: () => MonthlyBudget | undefined;
  undo: () => void;
  canUndo: boolean;
  getRecurringExpenses: () => Expense[];
  removeRecurringExpense: (id: string) => void;
}

const FinanceContext = createContext<FinanceContextType | null>(null);

export function FinanceProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [previousState, setPreviousState] = React.useState<FinanceState | null>(null);

  // Load data from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        dispatch({ type: 'LOAD_DATA', payload: { ...initialState, ...parsed } });
      } catch (e) {
        console.error('Failed to load saved data:', e);
      }
    }
  }, []);

  // Save to localStorage whenever state changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  // Generate recurring expenses for the current month
  useEffect(() => {
    const recurringParents = state.expenses.filter(e => e.isRecurring && !e.recurringParentId);
    const currentMonth = state.currentMonth;
    
    recurringParents.forEach(parent => {
      // Check if this recurring expense already has an entry for this month
      const existingForMonth = state.expenses.find(
        e => e.recurringParentId === parent.id && e.date.startsWith(currentMonth)
      );
      
      if (!existingForMonth) {
        // Generate the expense for this month
        const dueDay = parent.recurringDueDay || 1;
        const monthDate = parse(currentMonth, 'yyyy-MM', new Date());
        const maxDay = getDaysInMonth(monthDate);
        const actualDay = Math.min(dueDay, maxDay);
        const dateStr = `${currentMonth}-${actualDay.toString().padStart(2, '0')}`;
        
        const newExpense: Expense = {
          id: generateId(),
          date: dateStr,
          description: parent.description,
          amount: parent.amount,
          categoryId: parent.categoryId,
          paymentMethod: parent.paymentMethod,
          isInstallment: false,
          createdAt: new Date().toISOString(),
          recurringParentId: parent.id,
        };
        
        dispatch({ type: 'ADD_EXPENSE', payload: newExpense });
      }
    });
  }, [state.currentMonth, state.expenses]);

  const saveForUndo = useCallback(() => {
    setPreviousState(state);
  }, [state]);

  const addExpense = useCallback((expense: Omit<Expense, 'id' | 'createdAt'>) => {
    saveForUndo();
    const newExpense: Expense = {
      ...expense,
      id: generateId(),
      createdAt: new Date().toISOString(),
    };
    dispatch({ type: 'ADD_EXPENSE', payload: newExpense });
    toast({
      title: 'Gasto registrado',
      description: `${expense.description} adicionado com sucesso.`,
    });
  }, [saveForUndo]);

  const addInstallmentExpense = useCallback((
    expense: Omit<Expense, 'id' | 'createdAt'>,
    totalInstallments: number
  ) => {
    saveForUndo();
    const expenseId = generateId();
    const startMonth = expense.date.substring(0, 7);
    
    const installmentAmounts = calculateInstallments(expense.amount, totalInstallments, startMonth);
    
    const newExpense: Expense = {
      ...expense,
      id: expenseId,
      createdAt: new Date().toISOString(),
      isInstallment: true,
      totalInstallments,
      installmentNumber: 1,
    };
    
    const installments: Installment[] = installmentAmounts.map((inst, idx) => ({
      id: generateId(),
      expenseId,
      dueMonth: inst.month,
      installmentIndex: inst.index,
      amount: inst.amount,
      paid: false,
    }));
    
    dispatch({ type: 'ADD_INSTALLMENT_EXPENSE', payload: { expense: newExpense, installments } });
    toast({
      title: 'Compra parcelada registrada',
      description: `${expense.description} em ${totalInstallments}x adicionado com sucesso.`,
    });
  }, [saveForUndo]);

  const updateExpense = useCallback((expense: Expense) => {
    saveForUndo();
    dispatch({ type: 'UPDATE_EXPENSE', payload: expense });
  }, [saveForUndo]);

  const deleteExpense = useCallback((id: string) => {
    saveForUndo();
    dispatch({ type: 'DELETE_EXPENSE', payload: id });
    toast({
      title: 'Gasto removido',
      description: 'O lançamento foi excluído.',
    });
  }, [saveForUndo]);

  const updateBudget = useCallback((budget: Omit<MonthlyBudget, 'id'>) => {
    const existing = state.budgets.find((b) => b.month === budget.month);
    const fullBudget: MonthlyBudget = {
      ...budget,
      id: existing?.id || generateId(),
    };
    dispatch({ type: 'UPDATE_BUDGET', payload: fullBudget });
    toast({
      title: 'Orçamento atualizado',
      description: 'As configurações do mês foram salvas.',
    });
  }, [state.budgets]);

  const updateCategories = useCallback((categories: Category[]) => {
    if (categories.length > 8) {
      toast({
        title: 'Limite de categorias',
        description: 'Máximo de 8 categorias permitido.',
        variant: 'destructive',
      });
      return;
    }
    dispatch({ type: 'UPDATE_CATEGORIES', payload: categories });
  }, []);

  const addFixedCommitment = useCallback((commitment: Omit<FixedCommitment, 'id'>) => {
    const newCommitment: FixedCommitment = {
      ...commitment,
      id: generateId(),
    };
    dispatch({
      type: 'ADD_FIXED_COMMITMENT',
      payload: { month: state.currentMonth, commitment: newCommitment },
    });
  }, [state.currentMonth]);

  const removeFixedCommitment = useCallback((commitmentId: string) => {
    dispatch({
      type: 'REMOVE_FIXED_COMMITMENT',
      payload: { month: state.currentMonth, commitmentId },
    });
  }, [state.currentMonth]);

  const setCurrentMonth = useCallback((month: string) => {
    dispatch({ type: 'SET_MONTH', payload: month });
  }, []);

  const closeDay = useCallback((notes?: string) => {
    const budget = state.budgets.find((b) => b.month === state.currentMonth);
    const { calculateAvailable, getMonthTotal } = require('@/lib/finance-utils');
    
    const available = calculateAvailable(
      budget,
      state.expenses,
      state.installments,
      state.currentMonth
    );
    
    const todayExpenses = state.expenses.filter((e) => e.date === getToday());
    
    const snapshot: DaySnapshot = {
      id: generateId(),
      date: getToday(),
      availableAtClose: available,
      totalExpenses: todayExpenses.reduce((sum, e) => sum + e.amount, 0),
      expenseCount: todayExpenses.length,
      notes,
    };
    
    dispatch({ type: 'CLOSE_DAY', payload: snapshot });
    toast({
      title: 'Dia encerrado',
      description: `Rotina do dia completa. Disponível: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(available)}`,
    });
  }, [state]);

  const getCurrentBudget = useCallback(() => {
    return state.budgets.find((b) => b.month === state.currentMonth);
  }, [state.budgets, state.currentMonth]);

  const getRecurringExpenses = useCallback(() => {
    return state.expenses.filter(e => e.isRecurring && !e.recurringParentId);
  }, [state.expenses]);

  const removeRecurringExpense = useCallback((id: string) => {
    saveForUndo();
    // Remove the parent recurring expense and all its children
    const childIds = state.expenses
      .filter(e => e.recurringParentId === id)
      .map(e => e.id);
    
    [...childIds, id].forEach(expenseId => {
      dispatch({ type: 'DELETE_EXPENSE', payload: expenseId });
    });
    
    toast({
      title: 'Compromisso fixo removido',
      description: 'O compromisso e seus lançamentos foram excluídos.',
    });
  }, [state.expenses, saveForUndo]);

  const undo = useCallback(() => {
    if (previousState) {
      dispatch({ type: 'UNDO_LAST', payload: previousState });
      setPreviousState(null);
      toast({
        title: 'Ação desfeita',
        description: 'A última ação foi revertida.',
      });
    }
  }, [previousState]);

  return (
    <FinanceContext.Provider
      value={{
        state,
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
        canUndo: !!previousState,
        getRecurringExpenses,
        removeRecurringExpense,
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
