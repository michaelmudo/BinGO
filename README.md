# BinGO

BinGO is a small Next.js app that asks for your location and shows nearby trash cans, recycling points, and water fountains on a map. It uses OpenStreetMap data through Overpass, so it can work anywhere that nearby points have been mapped.

## What is built

- Location permission flow with retry and demo locations
- Nearby trash, recycling, and water search
- Interactive Leaflet map
- Distance, direction, and filtering controls
- Community bins saved in the browser
- OpenStreetMap-powered API route

## Run locally

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

To enable the AI sorting helper, create `.env.local` and add:

```bash
GEMINI_API_KEY=your_gemini_api_key_here
```

The AI helper supports text descriptions and optional item photos from the camera or file picker.

Location sharing works best from `localhost` or a deployed HTTPS URL. If your browser blocks location in a preview frame, use one of the demo locations on the first screen.

## Deploy

This project can be deployed directly on Vercel. No API keys are required for the current OpenStreetMap/Overpass version.

## Next steps

- Move community bins from browser storage into a shared database.
- Add walking directions to the selected bin.
- Add city-specific official bin datasets for places where OpenStreetMap coverage is thin.
