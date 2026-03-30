# Programa de Pontos

Estrutura atual do repositório:

- `frontend/`: aplicação React + Vite + TypeScript
- `backend/`: API backend atual
- `supabase/`: migrations e Edge Functions

Comandos principais na raiz:

- `npm run dev:frontend`: sobe o frontend Vite em `http://localhost:8080`
- `npm run dev:backend`: sobe o backend a partir de `backend/src/server.ts`
- `npm run dev:full`: sobe frontend e backend juntos
- `npm run build`: gera build de frontend e backend
- `npm run build:frontend`: gera a build do frontend em `dist/`
- `npm run build:backend`: compila o backend em `backend/dist/`
- `npm run preview`: preview do frontend
- `npm run start`: inicia o backend compilado em `backend/dist/server.js`
- `npm run test`: executa os testes do backend
- `npm run typecheck`: executa typecheck de frontend e backend

Referências de configuração:

- frontend Vite: `frontend/vite.config.ts`
- frontend TypeScript: `frontend/tsconfig.json`
- backend TypeScript: `backend/tsconfig.json`
- testes backend: `backend/vitest.config.ts`
