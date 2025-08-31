# Advanced Exam Application

A comprehensive, production-ready exam platform built with Next.js 15, React 19, and Supabase. Features a light-only minimal UI, complete admin management system, WhatsApp integration, and robust student exam flow with Arabic/English localization support.

## ✨ Key Features

- **🎯 Student Experience**: Secure exam entry with codes, auto-save functionality, offline recovery, and built-in timers
- **👨‍💼 Admin Management**: Complete exam lifecycle management including creation, question management, global student administration, and results analysis  
- **📱 WhatsApp Integration**: Server capability to send codes via WhatsApp Cloud API with customizable templates
- **📊 Real-time Monitoring**: Live activity tracking, attempt monitoring, and comprehensive audit logging
- **📁 Multi-format Support**: CSV/XLSX import/export for questions, students, and results
- **🔒 Security Features**: IP tracking, attempt validation, and comprehensive audit trails
- **🌍 Internationalization**: Full Arabic and English support with RTL layout
- **♿ Accessibility**: WCAG compliant with screen reader support and keyboard navigation

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm ci --legacy-peer-deps
```

### 2. Environment Configuration

Create `.env.local` with your Supabase credentials:

```bash
# Supabase Configuration (Required)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# App Configuration
APP_BRAND_NAME="Advanced Exam App"
SESSION_PASSWORD=your-32-character-session-password
ADMIN_EMAILS="admin@example.com"

# WhatsApp Integration (Optional)
WHATSAPP_TOKEN=your_whatsapp_token
WHATSAPP_PHONE_ID=your_whatsapp_phone_id
```

### 3. Database Setup

Run the database setup script to create tables and initial data:

```bash
npm run setup:database
```

### 4. Start Development Server

```bash
npm run dev
# Server runs at: http://localhost:3000
```

### 5. Admin Access

- **Default Admin**: Username: `ehab`, Password: `436762`
- **Admin Panel**: Navigate to `/admin/login`
- **First-time Setup**: The first authenticated user is automatically promoted to admin

## 🗺️ Application Routes

### Public Routes (Student-facing)
- **`/`** — Home page with exam entry or results based on system mode
- **`/welcome/[attemptId]`** — Pre-exam instructions and welcome page
- **`/attempt/[attemptId]`** — Main exam interface with auto-save and offline recovery
- **`/thank-you/[attemptId]`** — Post-submission confirmation page
- **`/results`** — Public results portal for students to check their scores

### Admin Routes (Protected)
- **`/admin`** — Admin dashboard with system overview
- **`/admin/login`** — Admin authentication page
- **`/admin/exams`** — Exam management (create/edit/duplicate/publish/archive)
- **`/admin/exams/[examId]/questions`** — Question management with drag-and-drop reordering
- **`/admin/exams/[examId]/students`** — Student management and code generation
- **`/admin/students`** — Global student database management
- **`/admin/results`** — Results analysis and export capabilities
- **`/admin/monitoring`** — Live activity monitoring and attempt tracking
- **`/admin/audit`** — Comprehensive audit log viewer
- **`/admin/settings`** — Global settings (branding, language, WhatsApp templates)

## 🛠️ Development

### Architecture Overview
- **Framework**: Next.js 15 with App Router and React 19
- **Database**: Supabase (PostgreSQL) with Row Level Security
- **Styling**: Tailwind CSS v4 with custom UI primitives
- **State Management**: React Query v5 for server state
- **Authentication**: Custom auth system with JWT tokens
- **Internationalization**: Custom i18n with Arabic/English support

### UI System
Light-only UI primitives defined in `src/app/globals.css`:
- `.btn` — Button components with variants
- `.card` — Card containers with consistent styling
- `.input`, `.select`, `.textarea` — Form controls
- `.table` — Data table styling
- `.label`, `.link` — Typography elements

### Development Scripts

```bash
npm run dev              # Start development server (Turbopack)
npm run build            # Production build
npm run start            # Start production server
npm run lint             # ESLint code checking
npm run type-check       # TypeScript type checking

# Database utilities
npm run setup:database   # Initialize database schema
npm run setup:storage    # Setup Supabase storage buckets
npm run setup:logo       # Configure logo storage
```

### Key Development Files
- **Supabase Client**: `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`
- **Authentication**: `src/components/AdminGuard.tsx`, `src/hooks/useAdmin.ts`
- **Internationalization**: `src/i18n/student.ts`
- **Database Schema**: `db/schema.sql`, `db/security.sql`, `db/rpc_functions.sql`

## 🚀 Deployment

### Netlify Deployment
1. **CI/CD Pipeline**: Automated workflow in `.github/workflows/ci.yml`
2. **Build Configuration**: `netlify.toml` configured for Node.js 20
3. **Environment Variables**: Set the same variables from `.env.local` in Netlify dashboard
4. **Build Command**: `npm run build` with legacy peer deps support

### Environment Variables for Production
```bash
# Required for all deployments
NEXT_PUBLIC_SUPABASE_URL=your_production_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_production_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_production_service_role_key
APP_BRAND_NAME="Your Exam Platform"
SESSION_PASSWORD=secure-32-character-password
ADMIN_EMAILS="admin1@example.com,admin2@example.com"

# Optional WhatsApp integration
WHATSAPP_TOKEN=your_whatsapp_token
WHATSAPP_PHONE_ID=your_whatsapp_phone_id
```

## 🗄️ Database Architecture

### Core Tables
- **`exams`** — Exam definitions with settings and scheduling
- **`questions`** — Question bank with multiple question types
- **`students`** — Global student registry with unique codes
- **`student_exam_attempts`** — Per-exam attempt tracking
- **`exam_attempts`** — Individual attempt sessions with answers
- **`exam_results`** — Calculated scores and analytics
- **`exam_ips`** — IP whitelist/blacklist rules
- **`audit_logs`** — Comprehensive activity logging
- **`admin_users`** — Admin user management
- **`app_config`** — System-wide configuration

### Database Views
- **`student_exam_summary`** — Aggregated student statistics across all exams

### Stored Procedures (RPCs)
- **`start_attempt`** — Initialize new exam attempt
- **`get_attempt_state`** — Retrieve current attempt status
- **`save_attempt`** — Auto-save student progress
- **`submit_attempt`** — Finalize and score exam submission

### Security Features
- **Row Level Security (RLS)** — Granular access control
- **IP Tracking** — Geographic and network-based restrictions
- **Audit Logging** — Complete activity trail
- **Attempt Validation** — Prevent duplicate submissions

## 📊 Data Import/Export

### Supported Formats
- **Questions**: CSV/XLSX with type-specific validation
- **Students**: CSV/XLSX with `student_name`, `mobile_number`, `code`
- **Results**: Export to CSV, XLSX, or PDF formats

### Import Validation
- Real-time preview with error reporting
- Line-by-line validation feedback
- Automatic code generation for students
- Duplicate detection and handling

## 🔧 System Configuration

### Multi-Mode Operation
- **Exam Mode**: Standard exam delivery
- **Results Mode**: Public results portal only
- **Disabled Mode**: System maintenance with custom message

### Localization Support
- **Languages**: English and Arabic with RTL support
- **Customizable**: Welcome messages, instructions, and thank you pages
- **Font Support**: Tajawal font for Arabic text rendering

## 📚 Documentation & Resources

### 📖 User Guides
- **[Administrator Guide](ADMIN_GUIDE.md)** - Complete admin panel documentation
- **[Student Guide](STUDENT_GUIDE.md)** - How to take exams and use student features

### 🔧 Technical Documentation
- **[Project Roadmap](ROADMAP.md)** - Development phases and completion status
- **[Testing Summary](TESTING_SUMMARY.md)** - Quality assurance and test results
- **[Technology Stack](.kiro/steering/tech.md)** - Technical architecture details
- **[Product Overview](.kiro/steering/product.md)** - Feature specifications

### 🗄️ Database Resources
- **Database Scripts**: Schema and setup files in `db/` directory
- **Migration Files**: SQL files for database initialization
- **Security Policies**: Row Level Security configurations

## 🔒 Security Recommendations

- Enable Supabase Auth security features (leaked password protection, MFA)
- Use strong session passwords (32+ characters)
- Regularly review audit logs for suspicious activity
- Implement IP restrictions for sensitive exams
- Keep dependencies updated with `npm audit`
