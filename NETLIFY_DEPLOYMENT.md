# Netlify Deployment Guide

This guide will help you deploy the Advanced Exam Application to Netlify.

## Prerequisites

1. A Netlify account
2. A Supabase project with the database schema set up
3. Your GitHub repository connected to Netlify

## Environment Variables

Set these environment variables in your Netlify dashboard (Site settings → Environment variables):

### Required Variables

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Authentication Secret (generate a strong random string)
AUTH_SECRET=your-strong-random-secret-here

# Build Configuration
NODE_VERSION=20
NPM_FLAGS=--legacy-peer-deps
NEXT_TELEMETRY_DISABLED=1
```

### Optional Variables

```bash
# App Branding
APP_BRAND_NAME=Your Exam System Name

# Additional Supabase URL (for scripts)
SUPABASE_URL=https://your-project-ref.supabase.co
```

## Build Settings

In your Netlify site settings, configure:

- **Build command**: `npm ci --legacy-peer-deps && npm run build`
- **Publish directory**: `.next`
- **Node version**: `20`

## Database Setup

Before deploying, make sure your Supabase database is set up:

1. Run the SQL files in the `db/` directory in this order:
   - `schema.sql` - Core tables
   - `security.sql` - Row Level Security policies
   - `rpc_functions.sql` - Stored procedures
   - `indexes.sql` - Performance indexes
   - `app_settings.sql` - Default settings

2. Create your first admin user using the bootstrap API after deployment

## Deployment Steps

1. **Connect Repository**: Link your GitHub repository to Netlify
2. **Configure Environment**: Add all required environment variables
3. **Set Build Settings**: Configure build command and publish directory
4. **Deploy**: Trigger your first deployment
5. **Setup Database**: Run database setup scripts if needed
6. **Create Admin User**: Use the bootstrap endpoint to create your first admin

## Post-Deployment Setup

### Create First Admin User

After successful deployment, create your first admin user:

```bash
curl -X POST https://your-site.netlify.app/api/admin/bootstrap/create-first-user \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "your-secure-password",
    "email": "admin@yourdomain.com"
  }'
```

### Test the Application

1. Visit your Netlify URL
2. Check that the home page loads correctly
3. Try accessing `/admin/login` and log in with your admin credentials
4. Create a test exam to verify functionality

## Troubleshooting

### Build Failures

If the build fails:

1. Check that all environment variables are set correctly
2. Verify Node version is set to 20
3. Ensure `--legacy-peer-deps` flag is included in build command
4. Check build logs for specific error messages

### Runtime Issues

If the app deploys but doesn't work:

1. Verify Supabase connection by checking browser console
2. Ensure database schema is properly set up
3. Check that RLS policies are configured correctly
4. Verify environment variables are accessible at runtime

### Common Issues

- **TypeScript errors**: The build ignores TypeScript errors by default
- **Missing dependencies**: Use `--legacy-peer-deps` flag for npm install
- **Database connection**: Ensure Supabase URL and keys are correct
- **Authentication issues**: Verify AUTH_SECRET is set and strong

## Performance Optimization

The application includes several performance optimizations:

- Static content generation during build
- Edge caching for public API routes
- Optimized images and assets
- Compression and minification

## Security Considerations

- Never commit real environment variables to version control
- Use strong, unique secrets for AUTH_SECRET
- Keep Supabase service role key secure
- Enable HTTPS (automatic with Netlify)
- Configure proper CORS settings in Supabase

## Support

If you encounter issues:

1. Check the Netlify build logs
2. Review the browser console for client-side errors
3. Check Supabase logs for database issues
4. Refer to the main README.md for additional documentation

## Monitoring

The application includes built-in monitoring and health checks:

- Health endpoints: `/api/public/health`, `/api/admin/health`
- Performance monitoring dashboard in admin panel
- Automatic error tracking and recovery systems

Monitor your deployment through:
- Netlify Analytics
- Supabase Dashboard
- Application admin monitoring panel