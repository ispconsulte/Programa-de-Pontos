-- Adiciona política para que o usuário autenticado possa ler seu próprio registro na tabela users
CREATE POLICY user_read_own ON users
  FOR SELECT
  USING (id = auth.uid());
