# CFWW

Production website and operations frontend for CleanFreaks Window Washing.

## Purpose

This repository is the standalone replacement for the previous hosted website. It is served through GitHub Pages and connected directly to the CFWW Supabase project.

No payment processing is implemented. The site is built around:

- public service information
- maintenance plans
- weekend operating hours
- quote requests
- client records
- proposal creation and tracking
- client-facing proposal review

## Public routes

- `/`
- `/get-a-quote/`
- `/maintenance-plans/`
- `/operating-hours/`
- `/proposal/?token=...`

## Admin

- `/admin/`

The admin application uses Supabase Auth and Row Level Security. Access to operational data is restricted to the business-owner email stored in public site settings.

## Supabase

Project ref: `jsrvcmsnsbuuhtwtqvoq`

Main tables:

- `services`
- `maintenance_plans`
- `quote_requests`
- `contact_messages`
- `clients`
- `proposals`
- `proposal_items`
- `site_settings`

## Assets

Website images are stored directly in this repository under `/assets/`.

## Security

The browser uses only the Supabase publishable key. Secret and service-role credentials must never be committed to this repository.
