# Connect AIchemist to Supabase

The application runs in local-preview mode until Supabase is connected. Follow these steps to enable real accounts, saved boards, invitations, and real-time collaboration.

1. Create a Supabase project.
2. In its SQL Editor, run the migration files in order: [0001_aichemist.sql](supabase/migrations/0001_aichemist.sql), then [0002_create_board_rpc.sql](supabase/migrations/0002_create_board_rpc.sql). Together they create the profiles, boards, member access rules, invitation flow, Realtime publication, and the atomic board-creation function.
3. In Supabase **Authentication → URL Configuration**, add these redirect URLs for local work:

   - `http://localhost:3001/auth/callback`
   - `http://localhost:3001/**`

   Add your deployed domain's matching callback URL before deploying.
4. Copy `.env.example` to `.env.local` and fill in the values from **Project Settings → API**:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...
   CRON_SECRET=a-long-random-value
   ```

   Keep `SUPABASE_SERVICE_ROLE_KEY` and `CRON_SECRET` server-only. Never prefix them with `NEXT_PUBLIC_` or commit them.
5. To make email optional, enable **Authentication → Providers → Anonymous → Enable Anonymous Sign-Ins**. AIchemist's **Continue without email** button then creates a real Supabase guest account that can create and own private boards. It stays signed in in that browser; the guest identity is lost if browser storage is cleared. Enable CAPTCHA before exposing anonymous sign-in publicly.
6. Restart the development server. You can start as a guest immediately, or use an email link when you need the same account on another device. Then make a session from `/dashboard` and use **Share** to create an editor invite.

## Background AI autonomy

While a room is open, AIchemist already starts blank rooms and makes another contribution roughly every two minutes when autonomy is enabled.

For autonomy when nobody has the app open, schedule this protected endpoint every 10–15 minutes on your deployment platform:

```text
GET /api/cron/ai-pitch
Authorization: Bearer <CRON_SECRET>
```

The job only considers boards with autonomy enabled and human activity in the last 24 hours. It waits at least 15 minutes between background contributions per board.
