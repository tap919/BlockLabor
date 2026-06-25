# BlockLabor

BlockLabor is a professional staffing marketplace platform connecting businesses with skilled labor.

## Current Status
This project is currently in early-stage development.
- **Implemented**: Core UI skeleton, Supabase project setup, RLS policies, and foundation for Edge Function integrations.
- **In-Progress**: Integration logic for Dropbox Sign, QuickBooks, Gusto, and Okta.
- **Planned**: Full end-to-end testing coverage (Playwright/Vitest), production deployment pipeline, and final UI polish.

## Tech Stack
### Core (Implemented)
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, Zustand
- **Backend**: Supabase (Postgres, Auth, RLS)

### Integrations (In-Progress / Planned)
- **Dropbox Sign**: E-signature workflows
- **Twilio**: SMS communications
- **Checkr**: Candidate background verification
- **Okta**: Secure SSO
- **QuickBooks/Gusto**: Payroll & Accounting

## Development
1. Clone the repository.
2. `npm install`
3. Set up environment variables as specified in `.env.example`.
4. `npm run dev`

## Integration Architecture

BlockLabor serves as the orchestration layer for the following integrated systems:

- **Aetherdesk**: Utilizes AgentBrowser (via VibeServe) for enhanced customer service and Claw Protect for security.
- **Jobclaw**: Leverages Mutly for automated development workflows and Big Homie (via AgentBrowser) for AI-powered job hunting.
- **AgentBrowser**: The central UI and integration hub, consuming tools from VibeServe, Big Homie, and Mem0.
- **RepoRank**: Provides continuous code quality grading and security scanning across all integrated projects.
- **Claw Protect**: Enforces security policies and protects against prompt injection and data exfiltration across all agentic systems.

For detailed integration plans, see `docs/superpowers/plans/`.
