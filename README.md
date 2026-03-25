# PhantomDS

PhantomDS is a notes and tasks workspace in a black visual style with violet gradient accents. It is built for Vercel and stores synced data in a private Vercel Blob using `BLOB_READ_WRITE_TOKEN`.

## Important

The screenshots show Vercel Blob Storage, not a relational database. This app is implemented against Blob because that is the storage method you currently have. If you later switch to Vercel Postgres, the storage layer can be replaced without rebuilding the UI.

The token from the screenshot should be rotated in Vercel because it has been exposed.

## Local start

1. Install dependencies:

```bash
npm install
```

2. Create `.env.local` from `.env.example` and add a new rotated `BLOB_READ_WRITE_TOKEN`.

3. Run development mode:

```bash
npm run dev
```

## Deploy to Vercel

1. Push this project to GitHub.
2. Import the repository into Vercel.
3. Add `BLOB_READ_WRITE_TOKEN` in Project Settings -> Environment Variables.
4. Deploy.
