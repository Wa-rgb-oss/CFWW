# CFWW

New CleanFreaks Window Washing website.

## Supabase connection

This repository is connected to the Supabase project in the **CFWW** organization.

- Supabase project ref: `jsrvcmsnsbuuhtwtqvoq`
- Region: `us-east-1`
- Client helper: `supabase-client.js`
- Database schema: currently empty and ready for the new site

The client helper uses Supabase's publishable key, which is intended for browser/client use. Never commit a Supabase secret key or service-role key to this repository.

### CLI linking

If this repository is cloned to a development computer, link the Supabase CLI with:

```bash
supabase link --project-ref jsrvcmsnsbuuhtwtqvoq
```

The CLI may request the database password locally. Do not commit that password.

## Security

Any tables exposed through Supabase's Data API should have Row Level Security enabled and policies written for the site's actual access model.
