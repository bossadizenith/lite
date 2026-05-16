Hello i'm zenith. this just came in mind to have a changelog file of what i've worked on for that day.

first things first. what's this project? how's it use and why?

well it's simple as of now, this is mainly for eductional purposes for me to understand how system design works and in order for me to do that, i have to build something and why not build a mini vercel clone.i've always wondered how it works.

28.04.2026

- Learning how nextjs build works and how it's being served on the client side (browser)
- thinking of if we should remove vite from a static site to something more interesting. like running on same infra like nextjs that we're currently studying

  07.05.26

- moving off s3 to use container based deployments.
- updated the [schema](/packages/db/src/schema.ts) and the [api route](/apps/api/src/routes/projects/index.ts) so they both match the new use case we're trying to attain.

  13.05.26

- database: Updated the schema to support static vs container deployments and store runtime settings (ports, env vars).
- builder: Refactored to produce a high-performance S3 tarball instead of individual file uploads.
- generic runner: Built a lightweight Node.js container that pulls your S3 artifacts and runs npm start.
- api orchestration: Taught the API to launch these runners and inject your environment variables at runtime.
- smart proxy: Upgraded the proxy to automatically route traffic either to S3 (for static sites) or to the internal runner (for Next.js apps).

  14.05.26

- fixing the log streaming from the build-server on aws to the ui.

  16.05.26

- made the first succesful nextjs deployment on vercel lite clone!
- bundle the entire project root into a tarball
