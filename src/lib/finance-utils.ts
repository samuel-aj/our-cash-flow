import { Expense, Installment, MonthlyBudget, FixedCommitment } from '@/types/expense';
import { format, parse, addMonths, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function formatMonth(monthStr: string): string {
  const date = parse(monthStr, 'yyyy-MM', new Date());
  return format(date, 'MMMM yyyy', { locale: ptBR });
}

export function formatDate(dateStr: string): string {
  const date = parse(dateStr, 'yyyy-MM-dd', new Date());
  return format(date, 'dd/MM/yyyy', { locale: ptBR });
}

export function formatShortDate(dateStr: string): string {
  const date = parse(dateStr, 'yyyy-MM-dd', new Date());
  return format(date, "dd 'de' MMM", { locale: ptBR });
}

export function getCurrentMonth(): string {
  return format(new Date(), 'yyyy-MM');
}

export function getToday(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

/**
 * Calculates installment amounts with remainder on first installment
 */
export function calculateInstallments(
  total: number,
  numInstallments: number,
  startMonth: string
): { month: string; amount: number; index: number }[] {
  const baseAmount = Math.floor((total / numInstallments) * 100) / 100;
  const remainder = Math.round((total - baseAmount * numInstallments) * 100) / 100;
  
  const installments: { month: string; amount: number; index: number }[] = [];
  
  for (let i = 0; i < numInstallments; i++) {
    const monthDate = addMonths(parse(startMonth, 'yyyy-MM', new Date()), i);
    installments.push({
      month: format(monthDate, 'yyyy-MM'),
      amount: i === 0 ? baseAmount + remainder : baseAmount,
      index: i + 1,
    });
  }
  
  return installments;
}

/**
 * Calculate available amount for the month
 * Available = Income - Fixed Commitments - Installments Due This Month - Expenses This Month
 */
export function calculateAvailable(
  budget: MonthlyBudget | undefined,
  expenses: Expense[],
  installments: Installment[],
  month: string
): number {
  if (!budget) return 0;

  const income = budget.income;
  const fixedTotal = budget.fixedCommitments.reduce((sum, c) => sum + c.amount, 0);
  
  // Filter expenses for current month (excluding installment child entries)
  const monthExpenses = expenses.filter(
    (e) => e.date.startsWith(month) && !e.parentExpenseId
  );
  const expensesTotal = monthExpenses.reduce((sum, e) => sum + e.amount, 0);
  
  // Filter installments due this month
  const monthInstallments = installments.filter(
    (i) => i.dueMonth === month && !i.paid
  );
  const installmentsTotal = monthInstallments.reduce((sum, i) => sum + i.amount, 0);
  
  return income - fixedTotal - installmentsTotal - expensesTotal;
}

/**
 * Get expenses for a specific month, grouped by date
 */
export function getExpensesByDate(
  expenses: Expense[],
  month: string
): Map<string, Expense[]> {
  const monthExpenses = expenses
    .filter((e) => e.date.startsWith(month))
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  
  const grouped = new Map<string, Expense[]>();
  
  for (const expense of monthExpenses) {
    const existing = grouped.get(expense.date) || [];
    grouped.set(expense.date, [...existing, expense]);
  }
  
  return grouped;
}

/**
 * Get installments for upcoming months
 */
export function getUpcomingInstallments(
  installments: Installment[],
  expenses: Expense[],
  fromMonth: string,
  monthsAhead: number = 3
): Map<string, { installment: Installment; expense: Expense }[]> {
  const result = new Map<string, { installment: Installment; expense: Expense }[]>();
  
  const startDate = parse(fromMonth, 'yyyy-MM', new Date());
  
  for (let i = 0; i <= monthsAhead; i++) {
    const monthDate = addMonths(startDate, i);
    const monthStr = format(monthDate, 'yyyy-MM');
    
    const monthInstallments = installments
      .filter((inst) => inst.dueMonth === monthStr && !inst.paid)
      .map((inst) => {
        const expense = expenses.find((e) => e.id === inst.expenseId);
        return expense ? { installment: inst, expense } : null;
      })
      .filter(Boolean) as { installment: Installment; expense: Expense }[];
    
    if (monthInstallments.length > 0) {
      result.set(monthStr, monthInstallments);
    }
  }
  
  return result;
}

/**
 * Generate unique ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Calculate total for a specific month from expenses
 */
export function getMonthTotal(expenses: Expense[], month: string): number {
  return expenses
    .filter((e) => e.date.startsWith(month) && !e.parentExpenseId)
    .reduce((sum, e) => sum + e.amount, 0);
}

/**
 * Get installments total for a month
 */
export function getInstallmentsTotal(installments: Installment[], month: string): number {
  return installments
    .filter((i) => i.dueMonth === month && !i.paid)
    .reduce((sum, i) => sum + i.amount, 0);
}
