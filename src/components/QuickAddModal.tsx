import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useFinance } from '@/contexts/FinanceContext';
import { calculateInstallments, formatCurrency, getToday } from '@/lib/finance-utils';
import { PAYMENT_METHODS, type PaymentMethod } from '@/types/expense';
import { X, Calculator } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface QuickAddModalProps {
  open: boolean;
  onClose: () => void;
}

export function QuickAddModal({ open, onClose }: QuickAddModalProps) {
  const { state, addExpense, addInstallmentExpense } = useFinance();
  
  const [date, setDate] = useState(getToday());
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState(state.categories[0]?.id || '');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card');
  const [isInstallment, setIsInstallment] = useState(false);
  const [installments, setInstallments] = useState('2');

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setDate(getToday());
      setDescription('');
      setAmount('');
      setCategoryId(state.categories[0]?.id || '');
      setPaymentMethod('card');
      setIsInstallment(false);
      setInstallments('2');
    }
  }, [open, state.categories]);

  const parsedAmount = parseFloat(amount.replace(',', '.')) || 0;
  const parsedInstallments = parseInt(installments) || 2;

  const installmentPreview = isInstallment && parsedAmount > 0
    ? calculateInstallments(parsedAmount, parsedInstallments, date.substring(0, 7))
    : [];

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    
    if (!description.trim() || parsedAmount <= 0) {
      return;
    }

    const expenseData = {
      date,
      description: description.trim(),
      amount: parsedAmount,
      categoryId,
      paymentMethod,
      isInstallment,
    };

    if (isInstallment) {
      addInstallmentExpense(expenseData, parsedInstallments);
    } else {
      addExpense(expenseData);
    }

    onClose();
  }, [date, description, parsedAmount, categoryId, paymentMethod, isInstallment, parsedInstallments, addExpense, addInstallmentExpense, onClose]);

  // Keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && e.metaKey && open) {
        handleSubmit(e as unknown as React.FormEvent);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSubmit, open]);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            Novo Gasto
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Data</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="input-focus"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Valor (R$)</Label>
              <Input
                id="amount"
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="input-focus text-lg font-semibold"
                autoFocus
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Input
              id="description"
              placeholder="Ex: Supermercado, Almoço..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input-focus"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger className="input-focus">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {state.categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Forma de pagamento</Label>
              <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}>
                <SelectTrigger className="input-focus">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((method) => (
                    <SelectItem key={method.value} value={method.value}>
                      {method.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="border rounded-xl p-4 space-y-4 bg-muted/30">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="installment" className="text-sm font-medium">
                  Compra parcelada?
                </Label>
                <p className="text-xs text-muted-foreground">
                  Distribui automaticamente nos meses seguintes
                </p>
              </div>
              <Switch
                id="installment"
                checked={isInstallment}
                onCheckedChange={setIsInstallment}
              />
            </div>

            <AnimatePresence>
              {isInstallment && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-3 overflow-hidden"
                >
                  <div className="space-y-2">
                    <Label htmlFor="installments">Número de parcelas</Label>
                    <Input
                      id="installments"
                      type="number"
                      min="2"
                      max="36"
                      value={installments}
                      onChange={(e) => setInstallments(e.target.value)}
                      className="input-focus w-24"
                    />
                  </div>

                  {installmentPreview.length > 0 && (
                    <div className="p-3 rounded-lg bg-background border">
                      <p className="text-xs font-medium text-muted-foreground mb-2">
                        Prévia das parcelas:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {installmentPreview.slice(0, 6).map((inst) => (
                          <span
                            key={inst.month}
                            className="text-xs bg-primary/10 text-primary px-2 py-1 rounded"
                          >
                            {inst.index}ª: {formatCurrency(inst.amount)}
                          </span>
                        ))}
                        {installmentPreview.length > 6 && (
                          <span className="text-xs text-muted-foreground">
                            +{installmentPreview.length - 6} parcelas
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-primary hover:bg-primary/90"
              disabled={!description.trim() || parsedAmount <= 0}
            >
              Salvar
              <span className="ml-2 text-xs opacity-70">⌘↵</span>
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
