# VTC Attendance Checker

A browser bookmarklet for checking VTC attendance across modules. It combines VTC calendar events with attendance records and shows current attendance, future scheduled hours, projections, and 70%/80% status warnings.

The project is a static website and does not require a build step.

## Use it

1. Open the hosted site, or open `index.html` locally.
2. Select **get bookmarklet**.
3. Follow the setup page to add the bookmarklet to your browser bookmarks.
4. Open the VTC portal and sign in.
5. Run the bookmarklet from the VTC page.
6. Review the dashboard and double-check important results against the official VTC attendance record.

The bookmarklet stores temporary data in the browser's `localStorage`. It must be run on a page where the required VTC calendar and attendance information is available.

## Run locally

Because this is a static site, it can be opened directly in a browser. A local server is useful when testing browser behavior:

```sh
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

## Project structure

- `index.html` - landing page and language toggle
- `style.css` - shared styles
- `src/bookmarklet/help.html` - bookmarklet installation guide
- `src/bookmarklet/vtc-combined-grabber.js` - calendar and attendance data grabber
- `src/vtc-attendance.js` - dashboard and attendance calculations
- `src/bookmarklet/translations.js` - bookmarklet translations
- `img/` - tutorial media

## Notes

- Results are for reference only and are not guaranteed to be 100% accurate.
- Always verify attendance with the official VTC record.
- The bookmarklet is designed for the VTC portal and may stop working if the portal changes its page structure or access rules.

## Deploy

The repository can be deployed as a static site using GitHub Pages, Netlify, Vercel, or any other static hosting service. Publish the repository root without running a build command.
