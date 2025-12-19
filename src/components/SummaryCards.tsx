import { motion } from 'framer-motion';
import { useFinance } from '@/contexts/FinanceContext';
import { formatCurrency, getMonthTotal, getInstallmentsTotal } from '@/lib/finance-utils';
import { Wallet, CalendarClock, CreditCard, TrendingUp } from 'lucide-react';
import { INVESTMENT_CATEGORY_ID } from '@/types/expense';

export function SummaryCards() {
  const { state, getCurrentBudget } = useFinance();
  const budget = getCurrentBudget();

  const income = budget?.income || 0;
  const fixedTotal = budget?.fixedCommitments.reduce((sum, c) => sum + c.amount, 0) || 0;
  const installmentsTotal = getInstallmentsTotal(state.installments, state.currentMonth);
  
  // Calculate investments for this month
  const investmentsTotal = state.expenses
    .filter(e => e.date.startsWith(state.currentMonth) && e.categoryId === INVESTMENT_CATEGORY_ID)
    .reduce((sum, e) => sum + e.amount, 0);

  const cards = [
    {
      label: 'Receita mensal',
      value: income,
      icon: Wallet,
      color: 'text-primary',
      bgColor: 'bg-primary-light',
    },
    {
      label: 'Compromissos fixos',
      value: fixedTotal,
      icon: CalendarClock,
      color: 'text-muted-foreground',
      bgColor: 'bg-muted',
    },
    {
      label: 'Parcelas do mês',
      value: installmentsTotal,
      icon: CreditCard,
      color: 'text-warning',
      bgColor: 'bg-warning-light',
    },
    {
      label: 'Investido no mês',
      value: investmentsTotal,
      icon: TrendingUp,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-100 dark:bg-emerald-900/30',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((card, index) => (
        <motion.div
          key={card.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          className="summary-card flex items-center gap-4"
        >
          <div className={`p-3 rounded-xl ${card.bgColor}`}>
            <card.icon className={`h-5 w-5 ${card.color}`} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              {card.label}
            </p>
            <p className="text-xl font-semibold text-foreground">
              {formatCurrency(card.value)}
            </p>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

export function ExpensesTotalCard() {
  const { state } = useFinance();
  const expensesTotal = getMonthTotal(state.expenses, state.currentMonth);
  const expenseCount = state.expenses.filter(
    (e) => e.date.startsWith(state.currentMonth) && !e.parentExpenseId
  ).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="summary-card"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">
            Gastos do mês
          </p>
          <p className="text-2xl font-bold text-negative">
            -{formatCurrency(expensesTotal)}
          </p>
        </div>
        <div className="text-right">
          <span className="text-3xl font-bold text-muted-foreground/50">
            {expenseCount}
          </span>
          <p className="text-xs text-muted-foreground">lançamentos</p>
        </div>
      </div>
    </motion.div>
  );
}
