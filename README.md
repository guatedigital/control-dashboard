# Company Insights Dashboard

A modern, real-time dashboard that integrates data from PerfexCRM and Uchat APIs to provide comprehensive business insights.

## Tech Stack

- **Frontend**: Next.js 16.0.1 (LTS) with React 19 and TypeScript 5.9
- **UI**: shadcn/ui components with Tailwind CSS
- **Charts**: Recharts for data visualization
- **Database**: Supabase (PostgreSQL with real-time capabilities)
- **State Management**: TanStack Query (React Query)
- **Deployment**: Vercel

## Features

- 📊 Real-time metrics from PerfexCRM (customers, invoices, leads, revenue)
- 💬 Real-time chat metrics from Uchat (active chats, response times, satisfaction scores)
- 🔄 Automatic data synchronization with configurable polling intervals
- 📈 Interactive charts and visualizations
- 🎨 Modern, responsive UI design
- ⚡ Real-time updates via Supabase subscriptions
- 🛡️ Comprehensive error handling and retry logic

## Prerequisites

- Node.js 18+ and npm
- Supabase account and project
- API credentials for PerfexCRM and Uchat

## Setup Instructions

### 1. Clone and Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env.local` file in the root directory:

```bash
# PerfexCRM API Configuration
NEXT_PUBLIC_PERFEXCRM_API_URL=your_perfexcrm_api_url
PERFEXCRM_API_KEY=your_perfexcrm_api_key

# Uchat API Configuration
NEXT_PUBLIC_UCHAT_API_URL=your_uchat_api_url
UCHAT_API_KEY=your_uchat_api_key

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Data Sync Configuration
DATA_SYNC_INTERVAL=60000  # Interval in milliseconds (default: 60 seconds)
ENABLE_REALTIME=true
```

### 3. Set Up Supabase Database

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Navigate to the SQL Editor in your Supabase dashboard
3. Run the migration script from `supabase/migrations/001_initial_schema.sql`

This will create the necessary tables:
- `perfexcrm_metrics` - Cached PerfexCRM data
- `uchat_metrics` - Cached Uchat data
- `aggregated_insights` - Combined insights from both sources

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
control-dashboard/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   │   ├── perfexcrm/     # PerfexCRM proxy endpoints
│   │   ├── uchat/         # Uchat proxy endpoints
│   │   └── sync/          # Data synchronization endpoint
│   ├── dashboard/         # Dashboard page
│   └── layout.tsx         # Root layout
├── components/            # React components
│   ├── ui/               # shadcn/ui components
│   ├── charts/           # Chart components
│   └── dashboard/        # Dashboard-specific components
├── lib/                  # Utilities
│   ├── api/              # API clients
│   ├── supabase/         # Supabase configuration
│   ├── services/         # Business logic services
│   └── hooks/            # Custom React hooks
├── types/                # TypeScript definitions
└── supabase/             # Database migrations
```

## API Endpoints

### PerfexCRM Proxy

- `GET /api/perfexcrm?endpoint=statistics` - Get dashboard statistics
- `GET /api/perfexcrm?endpoint=customers` - Get customers
- `GET /api/perfexcrm?endpoint=invoices` - Get invoices
- `GET /api/perfexcrm?endpoint=leads` - Get leads

### Uchat Proxy

- `GET /api/uchat?endpoint=statistics` - Get dashboard statistics
- `GET /api/uchat?endpoint=chats` - Get chats
- `GET /api/uchat?endpoint=analytics` - Get analytics

### Data Synchronization

- `POST /api/sync` - Manually trigger data synchronization
  - Body: `{ "source": "all" | "perfexcrm" | "uchat" }`

## Deployment to Vercel

1. Push your code to a Git repository (GitHub, GitLab, or Bitbucket)
2. Import your project in [Vercel](https://vercel.com)
3. Add all environment variables from your `.env.local` file in Vercel's project settings
4. Deploy!

The project includes a `vercel.json` configuration file for optimal deployment settings.

## Configuration

### Data Sync Interval

The default data synchronization interval is 60 seconds (60000ms). You can adjust this by setting the `DATA_SYNC_INTERVAL` environment variable.

### Real-time Updates

Real-time updates are enabled by default. To disable, set `ENABLE_REALTIME=false` in your environment variables.

## Error Handling

The application includes comprehensive error handling:

- **API Client Retry Logic**: Automatic retry for transient failures (network errors, timeouts)
- **Error Boundaries**: React error boundaries to catch and display UI errors gracefully
- **User-Friendly Messages**: Clear error messages for different failure scenarios
- **Rate Limit Handling**: Graceful handling of API rate limits

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

### Adding New Metrics

1. Update the API client in `lib/api/` to fetch new data
2. Update the sync service in `lib/services/data-sync.ts` to store the data
3. Add new metric cards or charts in the dashboard components
4. Update the dashboard page to display the new metrics

## Troubleshooting

### Supabase Connection Issues

- Verify your Supabase URL and keys are correct
- Ensure Row Level Security (RLS) policies allow read access
- Check that the database migrations have been applied

### API Connection Issues

- Verify API URLs and keys are correct
- Check API rate limits
- Review API documentation for any endpoint changes

### Real-time Updates Not Working

- Ensure `ENABLE_REALTIME=true` in environment variables
- Check Supabase real-time is enabled in your project settings
- Verify database triggers are set up correctly

## License

MIT

## Support

For issues and questions, please check the API documentation:
- [PerfexCRM API](https://perfexcrm.themesic.com/apiguide/index.html)
- [Uchat API](https://www.uchat.com.au/api)

