import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence, useSpring, useTransform } from 'framer-motion';
import { useFinance } from '@/contexts/FinanceContext';
import { calculateAvailable, formatCurrency } from '@/lib/finance-utils';
import { TrendingDown, TrendingUp, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  const budget = getCurrentBudget();
  const [previousValue, setPreviousValue] = useState<number | null>(null);
  const [shouldPulse, setShouldPulse] = useState(false);

  const available = calculateAvailable(
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

  if (!budget) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card-elevated p-8 text-center"
      >
        <p className="text-muted-foreground mb-2">Configure o orçamento do mês</p>
        <p className="text-sm text-muted-foreground/70">
          Defina sua receita mensal e compromissos fixos para começar.
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
