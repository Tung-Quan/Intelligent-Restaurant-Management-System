## Restaurant Operations Dashboard

A web application for restaurant operations management, built with React + TypeScript + Vite, and connected to a backend REST API for authentication and business data.

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
- Backend REST API (`/api/v1`)
- TailwindCSS + shadcn/ui + Radix UI
- Vitest + Testing Library
- Playwright

## Environment Requirements

- Node.js 22.16.0+
- npm 11.7.0+

## Installation and Local Development

1. Install dependencies:

```bash
npm install
```

2. Create a `.env` file in the project root:

```env
VITE_API_BASE_URL=http://localhost:3000/api/v1
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
- `src/contexts/AuthContext.tsx`: authentication session and role management through the backend API
- `src/lib/api.ts`: shared REST API client for `/api/v1`

## Role-Based Access Control

The app uses route guards to control feature access by role:

- `admin`
- `manager`
- `server`
- `chef`
- `cashier`
- `host`

If a user has no assigned roles, the app applies a fallback to allow initial system setup for the first user.

## Backend Contract

The frontend expects the backend to expose the routes documented in `API_DESCRIPTION.md` under the base URL configured by `VITE_API_BASE_URL`.

## Testing

- Unit/Component test: Vitest + Testing Library
- E2E test: Playwright

## Suggested Development Workflow

1. Create a feature branch
2. Add or update migrations when schema changes
3. Run `npm run lint` and `npm run test` before merging
4. Verify production build with `npm run build`

## GitHub Pages Deployment

The repository includes a GitHub Actions workflow at `.github/workflows/deploy.yml` that:

- installs dependencies with `npm ci`
- uses `npm` version `11.7.0`
- runs `npm run lint`
- runs `npm run test`
- runs `npm run build`
- publishes the `dist` folder to GitHub Pages

### How to enable deployment

1. Push this repository to GitHub.
2. In GitHub, open `Settings > Pages`.
3. Set `Source` to `GitHub Actions`.
4. Add `VITE_API_BASE_URL` as a repository secret if your production API URL is different from local development.

### Workflow trigger

The deploy workflow runs automatically on pushes to the `main` branch and can also be started manually from the `Actions` tab.

## License

Internal use for learning and project development.
