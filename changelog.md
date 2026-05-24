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

  17.05.26

- i think i found the issue with the runner not using the lastest image push. (it was simply because of my stupidness, i used image sha rather than image tag(latest) and the sha was tied to one image which was the first image i pushed to the runner repo)

  19.05.26

- fixed the deployment issue i had. apparently it was the [runner dockerfile](/apps/runner/Dockerfile) that was not running the same node instance and the build server

  20.05.26

- changed the folder layout from builder images to pipelines and added the runner and change the builder/vite-next to just builder
- add npm, yarn, pnpm and bun to the docker images and implemented package manager detection.
- While building the vite integration, i learned that vite preview server binds to localhost by default(127.0.0.1 as the host) which made the public ip impossible to access it from outside the container. so the fix was pointed out by an agent that went on and added this argument `["run", "preview", "--", "--host", "0.0.0.0", "--port", port]` and what it actually does is that it it tells the preview to to use `0.0.0.0` (all interfaces) rather than on `127.0.0.1` (localhost) which is what was used by default. and this made it possible to access it from outside the container.

  24.05.26

- fix the identification bg stop issue. replaced normal div/p's with a table tag given that tr will expand even when there's an overflow
- change the action button the create.tsx from "Create" to "Deploy" i think i sounds more practical
- finally published the project on X. i've procrastinated on it now for like the entire week.
