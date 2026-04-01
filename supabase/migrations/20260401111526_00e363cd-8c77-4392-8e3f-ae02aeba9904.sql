UPDATE pontuacao_faturas_processadas 
SET status_processamento = 'pendente', 
    payload = jsonb_set(
      COALESCE(payload, '{}'::jsonb), 
      '{processing}', 
      'false'::jsonb
    )
WHERE status_processamento = 'erro' 
  AND payload->>'processing' = 'true';