# Cybersecurity Analyzer

An AI-assisted security scanner for Python code. Paste or drop in a snippet and get a prioritised list of vulnerabilities, each with a severity, CWE / OWASP mapping, an explanation and a suggested fix.

![Cybersecurity Analyzer](assets/cyber.png)

## How it works

1. The browser sends your code to a FastAPI backend.
2. A LangGraph agent runs [Semgrep](https://semgrep.dev) through its MCP server to find candidate issues.
3. An LLM served by [Groq](https://groq.com) triages the findings, explains them and proposes fixes.
4. The UI shows a risk score, a severity breakdown and expandable issue cards that you can filter, search, copy and export as Markdown or JSON.

## Features

- Glassmorphism UI with a dark gradient theme
- Paste, drop or load a sample file
- Risk gauge, severity bars, filters and search
- CWE and OWASP tags on every finding
- One-click copy of the suggested fix
- Markdown and JSON report export
- Session-only history of recent scans

## Bring your own key

The app never uses a server-side Groq key. Each visitor pastes their own key (get one free at [console.groq.com/keys](https://console.groq.com/keys)) and it is:

- held in browser memory only, never in local storage, cookies or URLs
- sent per request in the `X-Groq-Api-Key` header and used to build the Groq client for that request
- never logged or stored by the server; provider errors are logged without the key and the client only sees friendly messages

## Tech stack

| Layer          | Technology                                                  |
| -------------- | ----------------------------------------------------------- |
| Frontend       | Next.js (static export), React, TypeScript, Tailwind CSS v4 |
| Backend        | FastAPI, Python 3.12, `uv`                                  |
| Agent          | LangChain, LangGraph, Groq, Semgrep MCP server              |
| Packaging      | Single Docker image (FastAPI serves the built frontend)     |
| Infrastructure | Terraform on Azure (Container Apps, Container Registry)     |
| CI/CD          | GitHub Actions with OIDC login to Azure                     |

## Run locally

You need Python 3.12, [`uv`](https://docs.astral.sh/uv/), Node 20+ and a Semgrep token.

Create a `.env` file in the project root (it is git-ignored):

```bash
SEMGREP_APP_TOKEN=your-semgrep-token
```

Start the backend:

```bash
cd backend
uv run server.py
```

Start the frontend in a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000 and paste your Groq key when prompted.

## Run with Docker

```bash
docker build -t cyber-analyzer .
docker run --rm -p 8000:8000 --env-file .env cyber-analyzer
```

The app is served at http://localhost:8000.

## API

| Method | Path                | Description                                                    |
| ------ | ------------------- | -------------------------------------------------------------- |
| `GET`  | `/health`           | Liveness check                                                 |
| `POST` | `/api/validate-key` | Checks a Groq key by listing models (spends no tokens)         |
| `POST` | `/api/analyze`      | Analyses code and returns a security report (needs the header) |

## Tests

```bash
cd backend && uv run --with pytest pytest -q tests
cd frontend && npm run lint && npx tsc --noEmit
```

## Deploying to Azure

Infrastructure is defined in [`terraform/azure`](terraform/azure) and created once:

```bash
cd terraform/azure
terraform init
terraform apply -var "semgrep_app_token=$SEMGREP_APP_TOKEN" -var "container_image=<registry>.azurecr.io/cyber-analyzer:init"
```

After that, every push to `main` runs [CI](.github/workflows/ci.yml) (lint, type-check, build, tests, secret scan, Docker build) and then [deploys](.github/workflows/deploy-azure.yml): the image is built, pushed to Azure Container Registry and rolled out as a new Container App revision. The workflow authenticates with OpenID Connect, so no cloud credentials are stored in GitHub.

Required repository settings:

- Secrets: `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`
- Variables: `AZURE_RESOURCE_GROUP`, `AZURE_ACR_NAME`, `AZURE_CONTAINER_APP`
- A GitHub environment named `production`

Run `terraform destroy` when you no longer need the environment to avoid ongoing charges.
