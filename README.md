# BlockLabor

BlockLabor is a professional staffing marketplace platform designed to connect businesses with high-quality, pre-verified skilled labor. 

## Features
- **Job Posting & Management**: Streamlined tools for businesses to post and manage labor needs.
- **Contractor Matching**: Intelligent matching algorithm to find the right talent for the job.
- **Integrated Workflow**: Seamless onboarding, background checks, and e-signatures.
- **Automated Payroll**: Integration with financial systems to handle payments efficiently.

## Tech Stack
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, Zustand
- **Backend**: Supabase (Postgres, Auth, RLS, Edge Functions, Vault)
- **Integrations**: 
  - **Dropbox Sign**: E-signature workflows
  - **Twilio**: Communication and notifications
  - **Checkr**: Candidate background verification
  - **Okta**: Secure SSO for enterprise users
  - **QuickBooks/Gusto**: Automated payroll and financial synchronization
- **Observability**: Sentry
- **Testing**: Vitest, Playwright

## Development
1. Clone the repository.
2. `npm install`
3. Set up environment variables as specified in `.env.example`.
4. `npm run dev`

## Project Structure
- `src/`: Core application logic, features, and components.
- `supabase/`: Database migrations and Edge Functions for API integrations.
- `tests/`: End-to-end and unit testing suites.
