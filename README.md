# Think About It

A connected workspace for **Scheduling**, **Goals**, and **Resources**.

## Run locally

Install Node.js 20 or newer, then:

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Deploy

Import this GitHub repository into [Vercel](https://vercel.com/new) as a Next.js project. Vercel automatically detects the framework. Merge the starter pull request before deploying the main branch.

## Current limitations

This is an initial UI prototype. Tasks and blocks use local React state and reset when the page reloads. Weekly and monthly views, project management, resource links, accounts and Supabase persistence are planned features.

## Security

Do not commit Supabase service-role keys, passwords, or other secrets. Store deployment secrets in Vercel environment variables and enable Supabase row-level security before using personal data.
