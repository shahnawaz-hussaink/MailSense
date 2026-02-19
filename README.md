# MailSense — AI-Powered Email Intelligence Platform

> General-purpose email assistant powered by Gmail API, Appwrite, and OpenAI.

## Tech Stack

| Layer | Technology |
|---|---|
| Auth | Appwrite Auth (Google OAuth 2.0) |
| Database | Appwrite Database |
| Functions | Appwrite Functions (Node.js 21) |
| AI | OpenAI GPT-4o-mini |
| Payments | Stripe |
| Frontend | React + Tailwind (in `client/`) |

## Project Structure

```
MailSense/
├── client/          # React frontend (Vite + Tailwind)
├── server/
│   ├── functions/   # Appwrite Functions (one folder per function)
│   │   ├── authOnCreate/
│   │   ├── syncEmails/
│   │   ├── extractEntities/
│   │   ├── aiQuery/
│   │   ├── stripeWebhook/
│   │   └── deleteAccount/
│   └── shared/      # Shared utilities imported by functions
├── database/        # Appwrite collection schema definitions
├── docs/            # Architecture + setup guides
└── .github/
    └── workflows/   # CI/CD pipelines
```

## Environment Setup

Copy `.env.example` to `.env` in each function folder and fill in values.

See [`docs/env-setup.md`](docs/env-setup.md) for full reference.

## Local Development

```bash
# Deploy a function via Appwrite CLI
appwrite deploy function --functionId syncEmails

# Run all functions locally (requires Appwrite self-hosted)
appwrite run function
```

## Collections

- `users` — identity + encrypted Google tokens + sync cursor
- `emails` — normalized raw email data
- `extracted_entities` — AI-extracted entities (price, OTP, flight, job, etc.)
- `subscriptions` — Stripe subscription state (mirror)
