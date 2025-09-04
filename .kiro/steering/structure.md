# Project Structure

## Root Directory
```
├── .env.local              # Environment variables (not in git)
├── .github/                # CI/CD workflows
├── .kiro/                  # Kiro AI assistant configuration
├── .next/                  # Next.js build output
├── db/                     # Essential database schema and setup files
├── public/                 # Static assets (SVG icons)
├── src/                    # Source code (debug components removed)
├── package.json            # Dependencies and scripts
├── next.config.ts          # Next.js configuration
├── tsconfig.json           # TypeScript configuration
├── eslint.config.mjs       # ESLint configuration
├── postcss.config.mjs      # PostCSS/Tailwind configuration
├── netlify.toml            # Netlify deployment configuration
└── README.md               # Project documentation
```

## Source Code Organization (`src/`)

### App Directory (`src/app/`)
Next.js App Router structure with route groups:

```
src/app/
├── (public)/               # Public routes (no auth required)
│   ├── exam/[examId]/      # Exam entry page
│   └── attempt/[attemptId]/ # Exam taking interface
├── admin/                  # Admin routes (auth required)
│   ├── exams/              # Exam management
│   ├── results/            # Results and analytics
│   ├── monitoring/         # Live activity monitoring
│   ├── audit/              # Audit logs
│   └── settings/           # Global settings
├── api/                    # API routes
├── globals.css             # Global styles and CSS primitives
├── layout.tsx              # Root layout
├── page.tsx                # Home page
└── providers.tsx           # React Query and other providers
```

### Components (`src/components/`)
Reusable UI components:
- `AdminGuard.tsx` - Authentication wrapper for admin routes
- `ExamQuestion.tsx` - Question rendering component
- `ProgressBar.tsx` - Progress indicator
- `Timer.tsx` - Countdown timer component
- `ToastProvider.tsx` - Toast notification system

### Hooks (`src/hooks/`)
Custom React hooks:
- `useAdmin.ts` - Admin authentication and permissions

### Library (`src/lib/`)
Utility functions and configurations:
- `supabase/` - Supabase client configuration and helpers
- `admin.ts` - Admin-specific utilities
- `audit.ts` - Audit logging functions
- `authFetch.ts` - Authenticated API requests
- `ip.ts` - IP address utilities
- `randomization.ts` - Question randomization logic
- `token.ts` - JWT token handling
- `types.ts` - Shared TypeScript types

### Types (`src/types/`)
TypeScript type definitions:
- `seedrandom.d.ts` - Type definitions for seedrandom library

## Database (`db/`)
SQL files for database setup:
- `schema.sql` - Core table definitions
- `security.sql` - RLS policies and permissions
- `rpc_functions.sql` - Stored procedures
- `indexes.sql` - Database indexes for performance
- `app_settings.sql` - Global application settings
- `storage_setup.sql` - Supabase storage bucket setup

## Naming Conventions

### Files and Directories
- **Components**: PascalCase (`AdminGuard.tsx`)
- **Hooks**: camelCase with `use` prefix (`useAdmin.ts`)
- **Utilities**: camelCase (`authFetch.ts`)
- **Pages**: lowercase with hyphens for multi-word routes
- **API routes**: lowercase with RESTful naming

### Code Conventions
- **React components**: PascalCase
- **Functions and variables**: camelCase
- **Constants**: UPPER_SNAKE_CASE
- **CSS classes**: kebab-case (following BEM-like patterns)
- **Database**: snake_case for tables and columns

## Import Patterns
- Use `@/` alias for imports from `src/` directory
- Group imports: external libraries, then internal modules
- Prefer named exports over default exports for utilities