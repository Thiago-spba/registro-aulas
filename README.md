# 📘 Controle de Aulas — E.E. Prof. Simão Mathias

Aplicativo web (PWA) para registro semanal de aulas dadas em substituições, com login Google, salvamento automático na nuvem e exportação flexível para compartilhamento com a coordenação.

Desenvolvido para o Professor e Engenheiro de Computação Thiago Fernando — E.E. Prof. Simão Mathias, São Paulo - SP.

---

## ✨ Funcionalidades

### Registro de aulas
- Tabelas de Turno Manhã e Turno Tarde, com horários fixos da escola já configurados
- Intervalo destacado visualmente, separado das aulas
- Linha da tabela fica **vermelha automaticamente** ao preencher a turma — feedback visual imediato de aula registrada
- Navegação entre semanas, anteriores e futuras, com seletor direto por data (dia/mês/ano)
- Total de aulas calculado automaticamente por turno e por semana

### Conta e dados
- Login com Google — acesso pessoal e seguro
- Salvamento automático no Firestore, por usuário, sem botão de "salvar"
- Regras de segurança configuradas: cada usuário só acessa seus próprios dados

### Compartilhamento
- Exportar mês atual com um clique — junta automaticamente todas as semanas do mês corrente
- Exportar por período — escolha livremente "de qual semana até qual semana" (uma semana, um mês, um bimestre, o que for preciso)
- Arquivo gerado em **CSV/Excel**, com cada semana em uma seção numerada e identificada
- **Imprimir / salvar como PDF** direto do navegador

### Produtividade
- Bloco de notas com salvamento automático
- Notas apagadas vão para uma **lixeira temporária de 15 dias** antes da exclusão definitiva, com opção de restaurar
- Modo escuro / claro, com preferência salva no dispositivo
- PWA instalável — funciona como aplicativo nativo no computador ou celular, com ícone próprio

---

## 🛠️ Stack técnica

| Camada | Tecnologia |
|---|---|
| Frontend | React + Vite |
| Autenticação | Firebase Authentication (Google) |
| Banco de dados | Firestore |
| PWA | vite-plugin-pwa |
| Hospedagem | Vercel |

---

## 🚀 Rodando localmente

```bash
npm install
npm run dev
```

O app abre em `http://localhost:5173`.

## 🏗️ Build de produção

```bash
npm run build
```

Gera a pasta `dist/`, já com o service worker do PWA.

## 🔒 Publicar regras de segurança do Firestore

```bash
firebase deploy --only firestore:rules
```

Requer o Firebase CLI instalado:
```bash
npm install -g firebase-tools
firebase login
```
## 📂 Estrutura do projeto

```
src/
├── App.jsx        # Componente principal e lógica da aplicação
├── App.css        # Estilos, temas claro/escuro
├── firebase.js    # Configuração e funções do Firebase
└── main.jsx       # Ponto de entrada
public/
├── icon-192.png   # Ícone do PWA
└── icon-512.png   # Ícone do PWA (alta resolução)
firestore.rules    # Regras de segurança do banco de dados
```

---

## 📄 Licença

Projeto de uso pessoal — Professor Thiago Fernando.