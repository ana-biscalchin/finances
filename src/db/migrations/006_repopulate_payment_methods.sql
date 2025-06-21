INSERT INTO payment_methods (id, name) VALUES
  ('550e8400-e29b-41d4-a716-446655440001', 'PIX'),
  ('550e8400-e29b-41d4-a716-446655440002', 'Cartão de Crédito'),
  ('550e8400-e29b-41d4-a716-446655440003', 'Cartão de Débito'),
  ('550e8400-e29b-41d4-a716-446655440004', 'TED'),
  ('550e8400-e29b-41d4-a716-446655440005', 'DOC'),
  ('550e8400-e29b-41d4-a716-446655440006', 'Boleto'),
  ('550e8400-e29b-41d4-a716-446655440007', 'Dinheiro'),
  ('550e8400-e29b-41d4-a716-446655440008', 'Transferência Bancária'),
  ('550e8400-e29b-41d4-a716-446655440009', 'Cheque'),
  ('550e8400-e29b-41d4-a716-446655440010', 'Criptomoedas'),
  ('550e8400-e29b-41d4-a716-446655440011', 'Carteira Digital'),
  ('550e8400-e29b-41d4-a716-446655440012', 'Pagamento por App')
ON DUPLICATE KEY UPDATE name = VALUES(name); 