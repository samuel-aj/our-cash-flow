import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CATEGORIES = [
  { id: '1', name: 'Alimentação', keywords: ['restaurante', 'lanche', 'comida', 'mercado', 'supermercado', 'ifood', 'rappi', 'uber eats', 'padaria', 'açougue', 'feira', 'hortifruti', 'delivery', 'pizza', 'hamburguer', 'sushi', 'café', 'bar', 'bebida'] },
  { id: '2', name: 'Transporte', keywords: ['uber', '99', 'combustível', 'gasolina', 'etanol', 'estacionamento', 'pedágio', 'ônibus', 'metro', 'trem', 'passagem', 'táxi', 'cabify', 'manutenção carro', 'oficina', 'ipva', 'seguro auto'] },
  { id: '3', name: 'Moradia', keywords: ['aluguel', 'condomínio', 'luz', 'energia', 'água', 'gás', 'internet', 'telefone', 'iptu', 'manutenção casa', 'reforma', 'móveis', 'decoração', 'eletrodoméstico'] },
  { id: '4', name: 'Lazer', keywords: ['cinema', 'teatro', 'show', 'festa', 'viagem', 'hotel', 'airbnb', 'passeio', 'parque', 'museu', 'netflix', 'spotify', 'amazon prime', 'disney', 'streaming', 'jogo', 'game', 'ingresso'] },
  { id: '5', name: 'Saúde', keywords: ['farmácia', 'remédio', 'medicamento', 'médico', 'consulta', 'exame', 'hospital', 'clínica', 'dentista', 'plano de saúde', 'academia', 'suplemento', 'vitamina', 'terapia', 'psicólogo'] },
  { id: '6', name: 'Educação', keywords: ['escola', 'faculdade', 'curso', 'livro', 'material', 'mensalidade', 'udemy', 'coursera', 'alura', 'treinamento', 'workshop', 'palestra', 'certificado'] },
  { id: '7', name: 'Compras', keywords: ['roupa', 'sapato', 'acessório', 'eletrônico', 'celular', 'computador', 'notebook', 'presente', 'loja', 'shopping', 'amazon', 'mercado livre', 'shopee', 'shein', 'aliexpress'] },
  { id: '8', name: 'Investimentos', keywords: ['investimento', 'ação', 'fundo', 'tesouro', 'cdb', 'poupança', 'cripto', 'bitcoin', 'corretora', 'previdência', 'renda fixa', 'renda variável'] },
  { id: '9', name: 'Outros', keywords: [] },
];

function categorizeExpense(description: string): string {
  const lowerDesc = description.toLowerCase();
  
  for (const category of CATEGORIES) {
    for (const keyword of category.keywords) {
      if (lowerDesc.includes(keyword.toLowerCase())) {
        return category.id;
      }
    }
  }
  
  return '9'; // Outros
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64, fileType } = await req.json();
    
    if (!imageBase64) {
      return new Response(
        JSON.stringify({ success: false, error: 'No image provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'AI not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Processing image for expense extraction...');

    const prompt = `Analise esta imagem de fatura/extrato bancário e extraia TODAS as transações/compras encontradas.

Para cada transação, retorne:
- description: descrição da compra/transação
- amount: valor (apenas números, sem R$). Use valor POSITIVO para gastos/saídas e valor NEGATIVO para receitas/entradas.
- date: data no formato YYYY-MM-DD (se não encontrar a data, use null)
- paymentMethod: "card", "pix", "cash" ou "transfer" (baseado no contexto)

IMPORTANTE:
- Extraia TODAS as transações visíveis
- Ignore saldos, totais e informações que não são transações
- Se for uma fatura de cartão, o paymentMethod é "card"
- Se for um extrato bancário, analise cada transação individualmente
- DIFERENCIE entre entradas e saídas:
  - "Transferência RECEBIDA" ou "Depósito" = valor NEGATIVO (é dinheiro entrando)
  - "Transferência ENVIADA" ou "Pagamento" = valor POSITIVO (é dinheiro saindo)
  - Compras, faturas, boletos = valor POSITIVO (gastos)

Responda APENAS com um JSON válido no formato:
{
  "transactions": [
    {"description": "...", "amount": 123.45, "date": "2024-01-15", "paymentMethod": "card"},
    {"description": "Transferência recebida...", "amount": -500.00, "date": "2024-01-15", "paymentMethod": "pix"},
    ...
  ]
}`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: imageBase64 } }
            ]
          }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: 'AI credits exhausted. Please add credits.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ success: false, error: 'AI processing failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiResult = await response.json();
    const content = aiResult.choices?.[0]?.message?.content || '';
    
    console.log('AI Response:', content);

    // Extract JSON from response
    let transactions = [];
    try {
      // Try to find JSON in the response
      const jsonMatch = content.match(/\{[\s\S]*"transactions"[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        transactions = parsed.transactions || [];
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
    }

    // Add category to each transaction, preserving the sign for income vs expense
    const enrichedTransactions = transactions.map((t: any) => {
      const amount = parseFloat(t.amount) || 0;
      const description = (t.description || '').toLowerCase();
      
      // Double-check: if description indicates income but amount is positive, flip it
      const isIncome =
        description.includes('transferência recebida') ||
        description.includes('transferencia recebida') ||
        description.includes('recebid') ||
        description.includes('depósito') ||
        description.includes('deposito') ||
        description.includes('crédito em conta') ||
        description.includes('credito em conta') ||
        description.includes('estorno') ||
        description.includes('reembolso') ||
        description.includes('salário') ||
        description.includes('salario') ||
        description.includes('rendimento') ||
        description.includes('dividendo') ||
        description.includes('aluguel recebido');

      const isExpense =
        description.includes('transferência enviada') ||
        description.includes('transferencia enviada') ||
        description.includes('enviad') ||
        description.includes('pagamento') ||
        description.includes('compra') ||
        description.includes('fatura') ||
        description.includes('boleto');
      
      let finalAmount = Math.abs(amount);
      
      // For income, we'll flag it but keep amount positive for display
      // The frontend will handle the sign/treatment based on isIncome flag
      
      return {
        ...t,
        categoryId: isIncome ? null : categorizeExpense(t.description),
        amount: finalAmount,
        isIncome: isIncome,
      };
    });

    console.log(`Extracted ${enrichedTransactions.length} transactions`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        transactions: enrichedTransactions 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing expense:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
