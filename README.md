# CFWW

New codebase for the CleanFreaks Window Washing website.

## Current migration status

The public-facing Wix data has been migrated into Supabase and the site frontend has been rebuilt as a responsive static web app.

### Migrated from Wix

- 9 active booking services
- 6 public window-care pricing plans
- 11 visible Wix Store products
- Service and product media references
- Public business contact information

The new website reads this content directly from Supabase. Quote requests and contact messages now write directly into Supabase rather than Wix Forms.

### Not migrated automatically

- Wix member accounts
- historical bookings
- orders/payment history
- Wix checkout/payment processing
- Wix-specific editor layout internals

Those can be handled separately if needed. Customer/private historical data was intentionally not copied as part of the public-site migration.

## Files

- `index.html` — main website
- `styles.css` — responsive visual system
- `app.js` — Supabase data loading and forms
- `supabase-client.js` — safe browser client using the publishable key
- `.env.example` — connection reference for development

## Supabase

Organization: **CFWW**

Project ref: `jsrvcmsnsbuuhtwtqvoq`

Current public tables:

- `services`
- `membership_plans`
- `products`
- `site_settings`

Form tables:

- `quote_requests`
- `contact_messages`

All public Data API tables have Row Level Security enabled. Public catalog tables are read-only for visitors. Form tables allow inserts but do not allow visitors to read submissions.

## Local development

Because the frontend uses browser ES modules, serve the repository through a local web server rather than opening `index.html` directly.

For Supabase CLI workflows:

```bash
supabase link --project-ref jsrvcmsnsbuuhtwtqvoq
```

Never commit a Supabase secret key or service-role key.
