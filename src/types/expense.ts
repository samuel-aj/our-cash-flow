export interface Category {
  id: string;
  name: string;
  colorIndex: number; // 1-8 for category colors
}

export interface FixedCommitment {
  id: string;
  name: string;
  amount: number;
  dueDay?: number;
}

export interface Installment {
  id: string;
  expenseId: string;
  dueMonth: string; // YYYY-MM format
  installmentIndex: number;
  amount: number;
  paid: boolean;
}

export interface Expense {
  id: string;
  date: string; // YYYY-MM-DD
  description: string;
  amount: number;
  categoryId: string;
  paymentMethod: 'cash' | 'card' | 'pix' | 'transfer';
  isInstallment: boolean;
  totalInstallments?: number;
  installmentNumber?: number; // For display: "1/6"
  parentExpenseId?: string; // Reference to original installment expense
  notes?: string;
  createdAt: string;
  isRecurring?: boolean; // Fixed monthly commitment
  recurringDueDay?: number; // Day of month (1-31)
  recurringParentId?: string; // Reference to original recurring expense
}

export interface CategoryBudget {
  categoryId: string;
  plannedAmount: number;
}

export interface MonthlyBudget {
  id: string;
  month: string; // YYYY-MM format
  income: number;
  fixedCommitments: FixedCommitment[];
  categoryBudgets?: CategoryBudget[];
  closedAt?: string;
  notes?: string;
}

export interface DaySnapshot {
  id: string;
  date: string;
  availableAtClose: number;
  totalExpenses: number;
  expenseCount: number;
  notes?: string;
}

export interface FinanceState {
  categories: Category[];
  expenses: Expense[];
  installments: Installment[];
  budgets: MonthlyBudget[];
  snapshots: DaySnapshot[];
  currentMonth: string;
}

export const DEFAULT_CATEGORIES: Category[] = [
  { id: '1', name: 'Alimentação', colorIndex: 1 },
  { id: '2', name: 'Transporte', colorIndex: 2 },
  { id: '3', name: 'Moradia', colorIndex: 3 },
  { id: '4', name: 'Lazer', colorIndex: 4 },
  { id: '5', name: 'Saúde', colorIndex: 5 },
  { id: '6', name: 'Educação', colorIndex: 6 },
  { id: '7', name: 'Compras', colorIndex: 7 },
  { id: '8', name: 'Investimentos', colorIndex: 8 },
  { id: '9', name: 'Outros', colorIndex: 9 },
];

export const INVESTMENT_CATEGORY_ID = '8';

export const PAYMENT_METHODS = [
  { value: 'card', label: 'Cartão' },
  { value: 'cash', label: 'Dinheiro' },
  { value: 'pix', label: 'PIX' },
  { value: 'transfer', label: 'Transferência' },
] as const;

export type PaymentMethod = typeof PAYMENT_METHODS[number]['value'];
