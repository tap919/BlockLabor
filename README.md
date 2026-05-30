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
