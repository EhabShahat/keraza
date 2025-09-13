# Technology Stack

## Framework & Runtime
- **Next.js 15.4.6** with App Router and React 19
- **TypeScript 5** for type safety and development experience
- **Node.js 20** (production environment)
- **Production-ready** with all debug components removed

## Backend & Database
- **Supabase** for backend-as-a-service
  - PostgreSQL database with Row Level Security (RLS)
  - Real-time subscriptions for live monitoring
  - Custom authentication system with JWT
  - Storage buckets for logo and file uploads
  - Edge functions for serverless operations

## Frontend Libraries
- **React Query v5** (`@tanstack/react-query`) for server state management
- **React Hook Form** for form management with validation
- **Zod** for runtime schema validation
- **@dnd-kit** for drag-and-drop functionality (question reordering)
- **React Quill** for rich text editing in questions

## UI & Styling
- **Tailwind CSS v4** with PostCSS for modern styling
- **Custom CSS primitives** in `globals.css` (`.btn`, `.card`, `.input`, etc.)
- **Light-only theme** - clean, minimal design focused on functionality
- **Accessibility-first** with ARIA labels, keyboard navigation, and screen reader support
- **RTL Support** for Arabic language with proper text direction

## Data Processing & Export
- **Papa Parse** for CSV parsing and generation
- **XLSX** (SheetJS) for Excel file handling
- **jsPDF** for PDF report generation
- **Chart.js + react-chartjs-2** for data visualization and analytics

## Authentication & Security
- **Custom JWT system** using Jose library
- **IP tracking and restrictions** with CIDR support
- **Comprehensive audit logging** for all user actions
- **Seedrandom** for deterministic question randomization
- **Row Level Security** policies in Supabase

## Internationalization
- **Custom i18n system** supporting Arabic and English
- **Tajawal font** for Arabic text rendering
- **RTL layout support** with proper text direction
- **Localized date/time formatting** with Cairo timezone

## Development Tools
- **ESLint** with Next.js and TypeScript configurations
- **Turbopack** for fast development builds and hot reloading
- **Legacy peer deps** handling for compatibility
- **TypeScript strict mode** for enhanced type safety

## Common Commands

```bash
# Development
npm run dev              # Start dev server with Turbopack
npm run build            # Production build
npm run start            # Start production server
npm run lint             # Run ESLint
npm run type-check       # TypeScript type checking

# Database Setup
npm run setup:database   # Initialize database schema
npm run setup:storage    # Setup Supabase storage buckets
npm run setup:logo       # Configure logo storage

# Installation (required for peer dependency issues)
npm ci --legacy-peer-deps
```

## Deployment & Infrastructure
- **Netlify** hosting with Node.js 20 runtime
- **Environment variables** management for different environments
- **CI/CD pipeline** via GitHub Actions (`.github/workflows/ci.yml`)
- **Automatic deployments** with preview environments
- **Edge caching** for optimal performance

## Database Architecture
**Core Tables**: `exams`, `questions`, `students`, `student_exam_attempts`, `exam_attempts`, `exam_results`, `exam_ips`, `audit_logs`, `admin_users`, `app_config`

**Views**: `student_exam_summary` for aggregated student statistics

**Key RPCs**: `start_attempt`, `get_attempt_state`, `save_attempt`, `submit_attempt`

**Indexes**: Optimized for performance with proper indexing on frequently queried columns

## Performance Optimizations
- **Server-side rendering** for initial page loads
- **React Query caching** for reduced API calls
- **Image optimization** with Next.js Image component
- **Code splitting** for smaller bundle sizes
- **Database query optimization** with proper indexing