import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useFinance } from '@/contexts/FinanceContext';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency, getToday } from '@/lib/finance-utils';
import { toast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Upload, FileImage, FileText, Loader2, Check, X, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ExtractedTransaction {
  description: string;
  amount: number;
  date: string | null;
  paymentMethod: 'card' | 'pix' | 'cash' | 'transfer';
  categoryId: string;
  selected?: boolean;
}

interface UploadModalProps {
  open: boolean;
  onClose: () => void;
}

export function UploadModal({ open, onClose }: UploadModalProps) {
  const { addExpense, state } = useFinance();
  const [step, setStep] = useState<'upload' | 'processing' | 'review'>('upload');
  const [transactions, setTransactions] = useState<ExtractedTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getCategoryName = (categoryId: string) => {
    return state.categories.find(c => c.id === categoryId)?.name || 'Outros';
  };

  const handleFile = async (file: File) => {
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      toast({
        title: 'Arquivo não suportado',
        description: 'Use imagens (JPG, PNG, WebP) ou PDF.',
        variant: 'destructive',
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: 'Arquivo muito grande',
        description: 'O arquivo deve ter no máximo 10MB.',
        variant: 'destructive',
      });
      return;
    }

    setStep('processing');
    setIsLoading(true);

    try {
      // Convert file to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
      });
      reader.readAsDataURL(file);
      const base64 = await base64Promise;

      // Call edge function
      const { data, error } = await supabase.functions.invoke('categorize-expense', {
        body: { 
          imageBase64: base64,
          fileType: file.type,
        },
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Failed to process file');
      }

      const extractedTransactions = (data.transactions || []).map((t: any) => ({
        ...t,
        date: t.date || getToday(),
        selected: true,
      }));

      if (extractedTransactions.length === 0) {
        toast({
          title: 'Nenhuma transação encontrada',
          description: 'Não foi possível extrair transações desta imagem.',
          variant: 'destructive',
        });
        setStep('upload');
        setIsLoading(false);
        return;
      }

      setTransactions(extractedTransactions);
      setStep('review');
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: 'Erro ao processar',
        description: error instanceof Error ? error.message : 'Tente novamente.',
        variant: 'destructive',
      });
      setStep('upload');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const toggleTransaction = (index: number) => {
    setTransactions(prev => prev.map((t, i) => 
      i === index ? { ...t, selected: !t.selected } : t
    ));
  };

  const handleImport = () => {
    const selectedTransactions = transactions.filter(t => t.selected);
    
    if (selectedTransactions.length === 0) {
      toast({
        title: 'Selecione transações',
        description: 'Marque ao menos uma transação para importar.',
        variant: 'destructive',
      });
      return;
    }

    selectedTransactions.forEach(t => {
      addExpense({
        date: t.date || getToday(),
        description: t.description,
        amount: t.amount,
        categoryId: t.categoryId,
        paymentMethod: t.paymentMethod,
        isInstallment: false,
      });
    });

    toast({
      title: 'Transações importadas!',
      description: `${selectedTransactions.length} lançamento(s) adicionado(s).`,
    });

    handleClose();
  };

  const handleClose = () => {
    setStep('upload');
    setTransactions([]);
    setIsLoading(false);
    onClose();
  };

  const selectedCount = transactions.filter(t => t.selected).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className={cn(
          // Always fit inside viewport on mobile; prevent horizontal overflow from long text
          'w-[calc(100vw-1.5rem)] max-w-[calc(100vw-1.5rem)] overflow-hidden',
          'sm:w-[min(42rem,calc(100vw-2rem))] sm:max-w-2xl'
        )}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            {step === 'upload' && 'Upload de Fatura'}
            {step === 'processing' && 'Processando...'}
            {step === 'review' && 'Revisar Transações'}
          </DialogTitle>
          <DialogDescription>
            {step === 'upload' && 'Envie uma imagem ou PDF de fatura para extrair os gastos automaticamente.'}
            {step === 'processing' && 'Analisando a imagem com IA para extrair transações.'}
            {step === 'review' && 'Revise as transações encontradas e selecione as que deseja importar.'}
          </DialogDescription>
        </DialogHeader>

        <AnimatePresence mode="wait">
          {step === 'upload' && (
            <motion.div
              key="upload"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="py-6"
            >
              <div
                className={cn(
                  'border-2 border-dashed rounded-xl p-12 text-center transition-colors cursor-pointer',
                  dragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                )}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={handleInputChange}
                  className="hidden"
                />
                
                <div className="flex flex-col items-center gap-4">
                  <div className="p-4 rounded-full bg-primary/10">
                    <Upload className="h-8 w-8 text-primary" />
                  </div>
                  
                  <div>
                    <p className="text-lg font-medium">
                      Arraste um arquivo ou clique para selecionar
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      JPG, PNG, WebP ou PDF (máx. 10MB)
                    </p>
                  </div>

                  <div className="flex gap-4 mt-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <FileImage className="h-4 w-4" />
                      Print de fatura
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <FileText className="h-4 w-4" />
                      Extrato PDF
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {step === 'processing' && (
            <motion.div
              key="processing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="py-12 flex flex-col items-center gap-4"
            >
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-muted-foreground">Analisando imagem com IA...</p>
            </motion.div>
          )}

          {step === 'review' && (
            <motion.div
              key="review"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                <p className="text-sm text-muted-foreground">
                  {transactions.length} transação(ões) encontrada(s)
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="self-start sm:self-auto"
                  onClick={() => setTransactions(prev => prev.map(t => ({ ...t, selected: !selectedCount })))}
                >
                  {selectedCount === transactions.length ? 'Desmarcar todos' : 'Selecionar todos'}
                </Button>
              </div>

              <ScrollArea className="h-[300px] w-full rounded-lg border overflow-x-hidden">
                <div className="p-4 space-y-2 max-w-full">
                  {transactions.map((t, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className={cn(
                        'w-full max-w-full overflow-hidden flex items-center gap-3 p-3 rounded-lg border transition-colors',
                        t.selected ? 'bg-primary/5 border-primary/20' : 'bg-muted/50'
                      )}
                    >
                      <Checkbox
                        checked={t.selected}
                        onCheckedChange={() => toggleTransaction(index)}
                        className="shrink-0"
                      />

                      <div className="flex-1 min-w-0 overflow-hidden">
                        <p className="font-medium truncate text-sm" title={t.description}>
                          {t.description}
                        </p>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground min-w-0 overflow-hidden">
                          <span className="shrink-0">{t.date}</span>
                          <span className="shrink-0">•</span>
                          <span className="truncate min-w-0">{getCategoryName(t.categoryId)}</span>
                          <span className="shrink-0">•</span>
                          <span className="shrink-0 capitalize">{t.paymentMethod}</span>
                        </div>
                      </div>

                      <p
                        className={cn(
                          'font-semibold whitespace-nowrap shrink-0 text-sm',
                          t.amount >= 0 ? 'text-negative' : 'text-positive'
                        )}
                      >
                        {t.amount >= 0 ? '-' : '+'}{formatCurrency(Math.abs(t.amount))}
                      </p>
                    </motion.div>
                  ))}
                </div>
              </ScrollArea>

              <div className="pt-4 border-t">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm">
                    <span className="text-muted-foreground">Total selecionado: </span>
                    {(() => {
                      const total = transactions
                        .filter(t => t.selected)
                        .reduce((sum, t) => sum + t.amount, 0);
                      return (
                        <span className={cn('font-semibold', total >= 0 ? 'text-negative' : 'text-positive')}>
                          {total >= 0 ? '-' : '+'}{formatCurrency(Math.abs(total))}
                        </span>
                      );
                    })()}
                  </div>

                  <div className="flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
                    <Button variant="outline" onClick={handleClose} className="w-full sm:w-auto">
                      Cancelar
                    </Button>
                    <Button onClick={handleImport} disabled={selectedCount === 0} className="w-full sm:w-auto">
                      <Check className="h-4 w-4 mr-2" />
                      Importar {selectedCount} item(s)
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
