-- Create income categories table (user-customizable)
CREATE TABLE public.income_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  name text NOT NULL,
  color_index integer NOT NULL DEFAULT 1,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.income_categories ENABLE ROW LEVEL SECURITY;

-- RLS policy for income categories
CREATE POLICY "Users can manage their own income categories"
ON public.income_categories
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create incomes table
CREATE TABLE public.incomes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  month text NOT NULL, -- YYYY-MM format
  description text NOT NULL,
  amount numeric NOT NULL,
  category_id uuid REFERENCES public.income_categories(id) ON DELETE SET NULL,
  date date NOT NULL,
  notes text,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.incomes ENABLE ROW LEVEL SECURITY;

-- RLS policy for incomes
CREATE POLICY "Users can manage their own incomes"
ON public.incomes
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_incomes_user_month ON public.incomes(user_id, month);
CREATE INDEX idx_income_categories_user ON public.income_categories(user_id);