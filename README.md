<!-- README.md -->

<h1 align="center">🎯 Programa de Pontos</h1>

<p align="center">
  Plataforma web da ISP Consulte para acompanhamento de pontuação, metas, desempenho e engajamento em um ambiente moderno, organizado e de fácil utilização.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB"/>
  <img src="https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white"/>
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white"/>
  <img src="https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white"/>
  <img src="https://img.shields.io/badge/Programa_de_Pontos-FFB000?style=for-the-badge"/>
  <img src="https://img.shields.io/badge/ISP_CONSULTE-0EA5E9?style=for-the-badge"/>
</p>

---

## 📌 O que é

O **Programa de Pontos** é uma plataforma web criada para centralizar o acompanhamento de pontuação, metas e desempenho dentro da operação da **ISP Consulte**.

O sistema foi pensado para organizar as informações de forma clara, facilitar a visualização dos resultados e apoiar ações de engajamento, acompanhamento interno e reconhecimento com base na evolução dos participantes.

---

## 🎯 Intuito (por que existe)

- **Centralizar a pontuação**: reunir em um só ambiente o acompanhamento de pontos, metas e evolução.
- **Dar visibilidade ao desempenho**: facilitar a consulta de resultados e acompanhamento dos participantes.
- **Aumentar o engajamento**: tornar o programa mais claro, acessível e fácil de acompanhar no dia a dia.
- **Padronizar a visualização**: manter informações organizadas com uma experiência moderna e consistente.
- **Permitir evolução contínua**: facilitar melhorias e crescimento gradual da plataforma conforme novas necessidades surgirem.

---

## 🧩 Como funciona (visão rápida)

A aplicação organiza as informações do programa em uma interface web moderna e centralizada:

- **Painel de acompanhamento**: exibe informações principais do programa de forma rápida e objetiva.
- **Pontuação e evolução**: permite acompanhar o desempenho e a progressão dos participantes.
- **Metas e indicadores**: ajuda a visualizar resultados e metas definidas dentro do programa.
- **Organização de dados**: mantém os registros estruturados para consulta e acompanhamento contínuo.
- **Experiência web moderna**: entrega navegação rápida, visual limpo e interface voltada ao uso diário.

O fluxo geral é: **entrar → consultar pontuação → acompanhar evolução → analisar resultados → seguir a rotina do programa**.

## 🔒 Segurança e boas práticas

- Configurações sensíveis devem permanecer fora do código-fonte e em variáveis de ambiente.
- A estrutura da aplicação deve manter separação clara entre interface, regras e configuração.
- Alterações no programa devem preservar consistência dos dados e clareza na experiência do usuário.
- A evolução do sistema deve seguir uma organização que facilite manutenção e crescimento.

---

## 🚀 Stack principal

- **Frontend**: React, Vite e TypeScript
- **Dados e serviços**: Supabase
- **Ambiente de desenvolvimento**: Node.js e npm

---

## 🛠️ Estrutura do projeto

- `frontend/`: aplicação web em React/Vite
- `backend/`: API e regras de negócio em Fastify/TypeScript
- `supabase/`: migrations e funções auxiliares
- `dist/`: saída do build do frontend para deploy estático

---

## 📦 Scripts principais

- `npm run dev`: sobe o frontend local
- `npm run dev:full`: sobe frontend e backend juntos
- `npm run build`: builda frontend e backend
- `npm run build:frontend`: gera a pasta `dist/`
- `npm run test`: roda os testes do backend
- `npm run typecheck`: valida os tipos do frontend e backend

---

## ▲ Deploy

- O deploy da Vercel publica somente o frontend estático gerado em `dist/`.
- A configuração de deploy está versionada em `vercel.json`.
- Variáveis sensíveis devem ficar apenas na Vercel, Supabase ou ambiente local, nunca no Git.

---

## 👥 Desenvolvimento

Desenvolvido por:

**Time ISP Consulte**

- **Lorenzo Mancini Quinopi Tolentino**
- **Raphael Morais de Jesus Schultz**

---

## 📌 Versão

**v1.0.0**
