# Netlify Deployment Guide

Your app is now ready for Netlify deployment!

## What was created:

- **`dist/`** - Your frontend assets (static files from the `public` folder)
- **`functions/`** - Serverless backend function for Netlify
- **`netlify.toml`** - Netlify configuration file
- **`build-dist.js`** - Build script that creates the deployment structure

## Deployment Steps:

### Option 1: Deploy via Netlify CLI

```bash
npm install -g netlify-cli
netlify login
netlify deploy --prod
```

### Option 2: Connect GitHub Repository

1. Push your code to GitHub
2. Go to [app.netlify.com](https://app.netlify.com)
3. Click "New site from Git"
4. Select your repository
5. Netlify will auto-detect the build settings from `netlify.toml`

### Option 3: Manual Deployment

1. Build locally: `npm run build`
2. Go to [app.netlify.com](https://app.netlify.com)
3. Drag and drop the `dist` folder

## Important Notes:

1. **Database**: better-sqlite3 is not supported on Netlify's Node runtime. Consider:
   - Migrate to a cloud database (MongoDB, PostgreSQL, Supabase, Firebase)
   - Or use Netlify's KV store for data persistence

2. **File Uploads**: The `uploads` folder won't persist on Netlify. Consider:
   - Use AWS S3 or similar cloud storage
   - Or Netlify's blobs API

3. **Environment Variables**: 
   - Set in Netlify dashboard: Settings → Environment → Environment variables
   - Required: `JWT_SECRET`, database connection strings if migrating

4. **Build Command**: Automatically runs `npm run build` as specified in `netlify.toml`

## Next Steps:

1. Fix database persistence (migrate from SQLite)
2. Handle file uploads with cloud storage
3. Update API endpoints in frontend code if needed
4. Test locally before deploying to production

## To rebuild locally:

```bash
npm run build
```

The build process will:
- Copy all static assets to `dist/`
- Prepare backend functions in `functions/`
- Ready for Netlify deployment
