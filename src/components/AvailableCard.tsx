import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence, useSpring, useTransform } from 'framer-motion';
import { useFinance } from '@/contexts/FinanceContext';
import { calculateAvailableWithIncome, formatCurrency } from '@/lib/finance-utils';
import { TrendingDown, TrendingUp, AlertTriangle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMonthlyIncomes } from '@/hooks/useMonthlyIncomes';

interface AnimatedNumberProps {
  value: number;
  className?: string;
}

function AnimatedNumber({ value, className }: AnimatedNumberProps) {
  const spring = useSpring(value, { stiffness: 260, damping: 24 });
  const display = useTransform(spring, (v) => formatCurrency(v));
  const [displayValue, setDisplayValue] = useState(formatCurrency(value));

  useEffect(() => {
    spring.set(value);
  }, [spring, value]);

  useEffect(() => {
    return display.on('change', (v) => setDisplayValue(v));
  }, [display]);

  return <span className={className}>{displayValue}</span>;
}

export function AvailableCard() {
  const { state, getCurrentBudget } = useFinance();
  const { totalIncome, incomes, loading: incomesLoading } = useMonthlyIncomes(state.currentMonth);
  const budget = getCurrentBudget();
  const [previousValue, setPreviousValue] = useState<number | null>(null);
  const [shouldPulse, setShouldPulse] = useState(false);

  // Use incomes from Supabase if available, otherwise fallback to budget.income
  const effectiveIncome = incomes.length > 0 ? totalIncome : (budget?.income || 0);

  const available = calculateAvailableWithIncome(
    effectiveIncome,
    budget,
    state.expenses,
    state.installments,
    state.currentMonth
  );

  const isPositive = available >= 0;
  const isWarning = available > 0 && available < 500; // Warning threshold
  const isNegative = available < 0;

  useEffect(() => {
    if (previousValue !== null && previousValue !== available) {
      setShouldPulse(true);
      const timer = setTimeout(() => setShouldPulse(false), 400);
      return () => clearTimeout(timer);
    }
    setPreviousValue(available);
  }, [available, previousValue]);

  const cardClass = cn(
    'card-hero p-8 transition-all duration-300',
    isPositive && !isWarning && 'positive',
    isWarning && 'border-warning/30',
    isNegative && 'border-negative/30'
  );

  const getIcon = () => {
    if (isNegative) return <TrendingDown className="h-6 w-6 text-negative" />;
    if (isWarning) return <AlertTriangle className="h-6 w-6 text-warning" />;
    return <TrendingUp className="h-6 w-6 text-positive" />;
  };

  const getStatusText = () => {
    if (isNegative) return 'Atenção: orçamento excedido';
    if (isWarning) return 'Atenção: saldo baixo';
    return 'Saldo saudável';
  };

  // Show loading state while fetching incomes
  if (incomesLoading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card-elevated p-8 flex items-center justify-center"
      >
        <Loader2 className="h-6 w-6 text-muted-foreground animate-spin" />
      </motion.div>
    );
  }

  // If no budget and no incomes, show prompt to configure
  if (!budget && incomes.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card-elevated p-8 text-center"
      >
        <p className="text-muted-foreground mb-2">Configure suas finanças</p>
        <p className="text-sm text-muted-foreground/70">
          Cadastre suas receitas na seção "Receitas" ou configure o orçamento mensal para começar.
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cardClass}
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Disponível pra gastar hoje
          </h2>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Receita − compromissos − parcelas − gastos
          </p>
        </div>
        <motion.div
          initial={false}
          animate={{ scale: shouldPulse ? [1, 1.2, 1] : 1 }}
          transition={{ duration: 0.3 }}
        >
          {getIcon()}
        </motion.div>
      </div>

      <motion.div
        className={cn(
          'mb-4',
          shouldPulse && 'animate-number-pulse'
        )}
      >
        <AnimatedNumber
          value={available}
          className={cn(
            'hero-number',
            isPositive && !isWarning && 'positive',
            isWarning && 'text-warning',
            isNegative && 'negative'
          )}
        />
      </motion.div>

      <div className="flex items-center gap-2">
        <div
          className={cn(
            'h-2 w-2 rounded-full',
            isPositive && !isWarning && 'bg-positive',
            isWarning && 'bg-warning',
            isNegative && 'bg-negative'
          )}
        />
        <span className="text-sm text-muted-foreground">{getStatusText()}</span>
      </div>
    </motion.div>
  );
}
