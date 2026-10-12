-- Valor vendido digitado pelo vendedor vira pontuação = venda / custo.
-- Com 3 casas o preço final ficava alguns reais diferente do digitado; 6 casas mantém o centavo.
alter table ambientes alter column pontuacao type numeric(10,6);
