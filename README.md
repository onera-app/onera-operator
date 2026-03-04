# Onera Operator

**AI operator that runs growth and operations for your startup.**

Onera Operator is an open-source AI COO — a self-running system that continuously plans and executes tasks like marketing, outreach, competitive research, engineering, and daily reporting -- so founders can focus on building.

Enter your company name and website URL. The system auto-researches your company, creates a plan, and starts executing -- all within minutes.

> **Open-source alternative to [Polsia](https://polsia.com)** — built with Crawl4AI for deep web crawling, Resend for production email, E2B for sandboxed code execution, and the full Vercel AI SDK stack.

## How It Works

Onera Operator runs an autonomous **agent loop** that:

1. **Researches** your startup by deep-crawling your website (via Crawl4AI) and analyzing your product, audience, and competitors
2. **Plans** actionable tasks using an AI planner agent (3-7 tasks per cycle)
3. **Executes** automatable work through specialized agents (tweets, emails, research, engineering)
4. **Reports** progress with daily operational summaries sent to your inbox (via Resend)
5. **Repeats** every 4 hours, continuously operating your startup's growth engine

The dashboard gives you a real-time **Startup Operating System** view with a terminal bar showing live agent activity, task queues, social/outreach panels, and daily reports.

## Features

- **Autonomous agent loop** -- planner creates tasks, workers execute them, cycle repeats
- **Company auto-research** -- enter a URL, the system deep-crawls and understands your business
- **7 specialized agents** -- planner, twitter, outreach, research, **engineer**, report, chat
- **11 composable tools** -- every capability is a standalone tool agents can use
- **Deep web crawling via Crawl4AI** -- handles JS-rendered pages, dynamic sites, anti-bot measures
- **Real email sending via Resend** -- outreach emails and daily founder digests sent for real
- **Sandboxed code execution via E2B** -- engineering agent runs code safely in isolated VMs
- **Real Twitter/X posting** -- tweets actually post via Twitter API v2
- **Morning email digest** -- daily summary of what was accomplished and what's next, sent to founders
- **Credit system** -- 100 free credits per user, each task costs credits
- **LLM agnostic** -- swap between OpenAI, Anthropic, Azure, or local models via env vars
- **Real-time dashboard** -- 4-column layout with live polling (tasks, social, email, reports)
- **Blueprint UI** -- monospace technical aesthetic with dashed borders and terminal bar
- **Clerk authentication** -- production-ready auth with middleware route protection
- **Web search via Exa** -- agents can search the web for competitive intelligence and leads

## Architecture

```
+-----------------------------------------------------------+
|                    Next.js 15 Dashboard                    |
|  +----------+--------------+-------------+-----------+    |
|  | Company  |  Task List   |  Twitter &  |   Daily   |    |
|  | Status   |  & Activity  |  Email Feed |   Report  |    |
|  +----------+--------------+-------------+-----------+    |
|  [============= Terminal Bar (live agent activity) ======] |
|  [==================== Chat Bar ========================] |
+----------------------------+------------------------------+
                             | REST API
+----------------------------+------------------------------+
|                   Fastify Backend                          |
|  +--------------+  +------------+  +-----------------+    |
|  |   REST API   |  |  BullMQ    |  |   Agent Loop    |    |
|  |   Routes     |  |  Workers   |  |   Scheduler     |    |
|  +--------------+  +------------+  +-----------------+    |
+----------------------------+------------------------------+
                             |
+----------------------------+------------------------------+
|                     Agent Layer                            |
|  +----------+ +----------+ +----------+ +----------+      |
|  | Planner  | | Twitter  | | Outreach | | Research |      |
|  | Agent    | | Agent    | | Agent    | | Agent    |      |
|  +----------+ +----------+ +----------+ +----------+      |
|  +----------+ +----------+                                |
|  | Report   | |  Chat    |                                |
|  | Agent    | |  Agent   |                                |
|  +----------+ +----------+                                |
+----------------------------+------------------------------+
                             |
+----------------------------+------------------------------+
|                     Tools Layer                            |
|  generate_tweet  schedule_tweet  generate_email           |
|  send_email  competitor_research  find_leads              |
|  web_search  web_scraper  research_company_url            |
|  summarize_content                                        |
+----------------------------+------------------------------+
                             |
+----------------------------+------------------------------+
|                 AI Provider Layer                          |
|           Vercel AI SDK (provider agnostic)                |
|  OpenAI | Anthropic | Azure | OpenAI-compatible | Local   |
+-----------------------------------------------------------+
```

## Tech Stack

| Layer        | Technology                              |
|--------------|-----------------------------------------|
| Frontend     | Next.js 15, React 19, Tailwind CSS      |
| Backend      | Fastify, TypeScript                     |
| AI           | Vercel AI SDK v4                        |
| Auth         | Clerk                                   |
| Database     | PostgreSQL, Prisma ORM                  |
| Queue        | BullMQ, Redis                           |
| Search       | Exa API                                 |
| Web Crawling | Crawl4AI (deep crawling + JS rendering) |
| Email        | Resend (outreach + daily digest)        |
| Code Sandbox | E2B (isolated VM code execution)        |
| Social       | Twitter API v2 (real tweet posting)     |
| Monorepo     | pnpm workspaces                         |
| Deploy       | Docker, docker-compose                  |

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 9+
- PostgreSQL (or use Docker / Neon)
- Redis (or use Docker / Redis Cloud)

### 1. Clone and install

```bash
git clone https://github.com/onera-app/onera-operator.git
cd onera-operator
pnpm install
```

### 2. Set up environment

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```bash
# Required
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
AI_PROVIDER=openai          # openai | anthropic | azure | openai-compatible
AI_MODEL=gpt-4o
AI_API_KEY=sk-...

# Auth (Clerk)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Web search (optional but recommended)
EXA_API_KEY=...

# Email via Resend (optional — enables real email sending + founder digests)
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=Onera Operator <operator@yourdomain.com>

# Deep web crawling via Crawl4AI (optional — enables JS rendering)
# Start with: docker run -p 11235:11235 unclecode/crawl4ai:latest
# Or included in docker compose up
CRAWL4AI_API_URL=http://localhost:11235

# Sandboxed code execution via E2B (optional — enables engineering agent)
E2B_API_KEY=...

# Twitter/X posting (optional — enables real tweet posting)
TWITTER_API_KEY=...
TWITTER_API_SECRET=...
TWITTER_ACCESS_TOKEN=...
TWITTER_ACCESS_TOKEN_SECRET=...
```

### 3. Set up the database

```bash
# Option A: Local Docker
docker compose up postgres redis -d

# Option B: Cloud (Neon + Redis Cloud) -- just set URLs in .env

# Generate Prisma client and push schema
pnpm db:generate
pnpm db:push
```

### 4. Build and run

```bash
# Build all packages
pnpm build

# Start development mode (hot reload)
pnpm dev

# Or start individually:
pnpm dev:backend   # http://localhost:3001
pnpm dev:frontend  # http://localhost:3000
```

### Using Docker Compose (full stack)

```bash
cp .env.example .env
# Edit .env with your AI_API_KEY, Clerk keys, and optional integrations

docker compose up
```

This starts PostgreSQL, Redis, **Crawl4AI** (deep web crawler), the backend, and the frontend.

## LLM Provider Configuration

Onera Operator is **LLM agnostic**. Configure your provider via environment variables:

```bash
# OpenAI (default)
AI_PROVIDER=openai
AI_MODEL=gpt-4o
AI_API_KEY=sk-...

# Anthropic
AI_PROVIDER=anthropic
AI_MODEL=claude-sonnet-4-5
AI_API_KEY=sk-ant-...

# Azure OpenAI
AI_PROVIDER=azure
AI_MODEL=gpt-4o
AI_API_KEY=...
AI_BASE_URL=https://your-resource.openai.azure.com/

# Local / OpenAI-compatible (Ollama, LM Studio, etc.)
AI_PROVIDER=openai-compatible
AI_MODEL=llama3
AI_BASE_URL=http://localhost:11434/v1
```

## Project Structure

```
onera-operator/
├── packages/
│   ├── shared/        # Shared types and Zod schemas
│   ├── database/      # Prisma ORM schema and client
│   ├── ai/            # LLM provider abstraction (Vercel AI SDK)
│   ├── tools/         # Agent tools (10 capabilities)
│   ├── agents/        # Agent definitions (6 agents)
│   ├── backend/       # Fastify API server + BullMQ workers
│   └── frontend/      # Next.js 15 dashboard + Clerk auth
├── docker-compose.yml
├── .env.example
└── pnpm-workspace.yaml
```

## Agents

| Agent       | Description                                       | Tools Used                                    |
|-------------|---------------------------------------------------|-----------------------------------------------|
| Planner     | Generates structured task plans from startup context | (structured output via Zod schema)          |
| Twitter     | Composes and posts tweets via Twitter API v2      | generateTweet, scheduleTweet                  |
| Outreach    | Writes personalized cold emails, finds leads      | generateEmail, sendEmail, findLeads           |
| Research    | Competitive analysis and market research          | competitorResearch, webSearch, webScraper, summarize |
| **Engineer** | **Writes and executes code in E2B sandbox**      | **executeCode, webSearch, webScraper, summarize** |
| Report      | Generates daily reports + emails them to founder  | (structured output + Resend)                  |
| Chat        | Interactive assistant with access to all tools    | All tools including executeCode               |

## Tools

Every agent capability is a standalone tool in `/packages/tools/`:

| Tool                  | Description                                |
|-----------------------|--------------------------------------------|
| `generateTweet`       | Generate engaging tweet content            |
| `scheduleTweet`       | Post a tweet via Twitter API v2 (real posting) |
| `generateEmail`       | Write personalized outreach emails         |
| `sendEmail`           | Send an email via Resend (real delivery)   |
| `competitorResearch`  | Analyze competitors                        |
| `findLeads`           | Generate lead profiles                     |
| `webSearch`           | Search the web via Exa API                 |
| `webScraper`          | Deep-crawl web pages via Crawl4AI (JS rendering + fallback) |
| `researchCompanyUrl`  | Auto-research a company from its website   |
| `summarizeContent`    | Summarize text content                     |
| `executeCode`         | Run Python/JS/bash code in E2B sandbox     |

Adding a new tool: create a file in `packages/tools/src/` using the Vercel AI SDK `tool()` function with a Zod `parameters` schema.

## API Endpoints

| Method | Endpoint                | Description                    |
|--------|-------------------------|--------------------------------|
| GET    | `/api/health`           | Health check (db + redis)      |
| GET    | `/api/projects`         | List projects                  |
| POST   | `/api/projects`         | Create project (triggers agent loop) |
| GET    | `/api/tasks`            | List tasks (filter by projectId) |
| POST   | `/api/tasks`            | Create a task                  |
| PATCH  | `/api/tasks/:id`        | Update task status             |
| GET    | `/api/tasks/metrics`    | Task metrics for a project     |
| GET    | `/api/agents`           | List agent statuses            |
| GET    | `/api/agents/logs`      | Recent execution logs          |
| GET    | `/api/activity`         | Terminal activity feed          |
| GET    | `/api/reports`          | List daily reports             |
| GET    | `/api/reports/latest`   | Latest daily report            |
| POST   | `/api/reports/generate` | Trigger report generation      |
| POST   | `/api/chat`             | Streaming chat (SSE)           |
| POST   | `/api/loop/trigger`     | Manually trigger agent loop    |

## Credits System

Each user starts with **100 free credits**. Every task execution costs credits (default: 1 credit per task). Credits are checked and deducted before a task worker runs an agent. When credits run out, tasks are not executed until credits are replenished.

## Contributing

Contributions are welcome. To add a new agent:

1. Create a tool in `packages/tools/src/` using `tool()` from the Vercel AI SDK
2. Create an agent in `packages/agents/src/` that composes your tools
3. Register it in `packages/agents/src/registry.ts`
4. The agent is now available to the task worker and chat

## License

MIT
