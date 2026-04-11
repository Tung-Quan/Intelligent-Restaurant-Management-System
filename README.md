## Restaurant Operations Dashboard

A web application for restaurant operations management, built with React + TypeScript + Vite, and powered by Supabase for authentication and database services.

## Project Goals

- Manage orders, kitchen workflow, tables, reservations, billing, and inventory
- Provide a daily operational overview dashboard
- Enforce role-based access control (admin, manager, server, chef, cashier, host)
- Deliver a modern UI using TailwindCSS + shadcn/ui

## Tech Stack

- React 18 + TypeScript
- Vite 5
- React Router
- TanStack Query
- Supabase (Auth + Postgres)
- TailwindCSS + shadcn/ui + Radix UI
- Vitest + Testing Library
- Playwright

## Environment Requirements

- Node.js 18+
- npm 9+

## Installation and Local Development

1. Install dependencies:

```bash
npm install
```

2. Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
```

3. Start the development server:

```bash
npm run dev
```

4. Open the app in your browser:

```text
http://localhost:5173
```

## Available Scripts

- `npm run dev`: start local development server
- `npm run build`: create production build
- `npm run build:dev`: build with development mode
- `npm run preview`: preview production build locally
- `npm run lint`: run ESLint checks
- `npm run test`: run tests with Vitest
- `npm run test:watch`: run tests in watch mode

## Project Structure (Overview)

- `src/pages`: main screens (Dashboard, Orders, Kitchen, Tables, Reservations, Billing, Inventory, Analytics, Admin)
- `src/components`: layout and reusable UI components
- `src/components/ui`: shadcn/ui components
- `src/contexts/AuthContext.tsx`: authentication session and role management
- `src/integrations/supabase`: Supabase client and generated types
- `supabase/migrations`: SQL migrations for database schema

## Role-Based Access Control

The app uses route guards to control feature access by role:

- `admin`
- `manager`
- `server`
- `chef`
- `cashier`
- `host`

If a user has no assigned roles, the app applies a fallback to allow initial system setup for the first user.

## Database and Migrations

The `supabase/migrations` directory contains SQL migration files.

If you use Supabase CLI, apply migrations according to your local or remote project workflow.

## Testing

- Unit/Component test: Vitest + Testing Library
- E2E test: Playwright

## Suggested Development Workflow

1. Create a feature branch
2. Add or update migrations when schema changes
3. Run `npm run lint` and `npm run test` before merging
4. Verify production build with `npm run build`

## License

Internal use for learning and project development.

