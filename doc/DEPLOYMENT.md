# Development and deployment

[Product overview](../README.md) | [中文产品介绍](../README.zh-CN.md)

This guide covers the React application in `web/`. The management backend is deployed separately.

## Local development

Use Node.js 24, matching the Docker build environment. Install the frontend's locked dependencies from the repository root:

```powershell
npm --prefix web ci
```

Create `web/.env.local` using [web/.env.example](../web/.env.example) as a starting point. Configure the API address and shared access key before starting Vite:

```dotenv
VITE_VISITSAFE_API_URL=https://your-api.example.com
VITE_VISITSAFE_API_KEY="replace-with-api-key"
```

The API address must be reachable from the visitor's browser and must not include `/api/v1`. An empty address uses the frontend origin; an external reverse proxy must then route API requests to the backend. The container's Nginx configuration serves static files only.

The shared access key is included in browser code. Quote values containing `#` in dotenv files; escape literal `$` characters as `\$` when using Vite dotenv files.

```powershell
npm run dev
```

Open the local URL printed by Vite. A phone on the same network can use the printed Network URL. Restart Vite after editing environment files.

## Verification and production build

```powershell
npm test
npm run typecheck
npm run build
```

The production output is `web/dist/`. Configure the static host to fall back to `index.html` for application routes. Assets and demonstration videos are packaged with the build; retain their license files.

The repository also provides Playwright browser scenarios:

```powershell
npx --prefix web playwright install chromium
npm run test:e2e
```

Some existing browser scenarios still use the earlier local demonstration model. They do not establish API integration coverage; see the [frontend notes](../web/README.md). Automated phone viewports do not replace checks on a real phone.

## Build and run with Docker Compose

The [Dockerfile](../Dockerfile) builds the frontend with Node 24 and serves it with Nginx Alpine. It includes application-route fallback, missing-asset 404 responses, index revalidation, and a `/healthz` endpoint.

Set the frontend's API configuration in your shell before building:

```powershell
$env:VITE_VISITSAFE_API_URL = 'https://your-api.example.com'
$env:VITE_VISITSAFE_API_KEY = 'replace-with-api-key'
docker compose up --build -d
docker compose ps
```

Open `http://SERVER_IP:8080`. Set `HTTP_PORT` to change the host port, for example `$env:HTTP_PORT = '8090'`.

[Compose](../docker-compose.yml) passes both `VITE_VISITSAFE_*` variables as build arguments. Vite writes these values into the production assets. Rebuild after changing them; restarting the container or setting runtime environment variables does not rewrite an existing bundle. Local `web/.env.local` files are excluded from the Docker build context.

The frontend container needs no host-directory mounts or data volume. Visit and training data are obtained through the API; the browser retains local drafts and access credentials.

## Portainer: build from the Git repository

For a Docker Standalone environment connected through its local Docker socket, use **Stacks → Add stack → Repository**:

| Setting | Value |
| --- | --- |
| Name | `visitsafe` |
| Repository URL | `https://github.com/neozhu/visit-traning-client.git` |
| Repository reference | Your deployment branch, for example `refs/heads/feat/visitsafe-react-mobile` |
| Compose path | `docker-compose.yml` |
| Environment variables | `VITE_VISITSAFE_API_URL`, `VITE_VISITSAFE_API_KEY`; optionally `HTTP_PORT=8080` |
| Re-pull image | Off; this Compose file builds from source |

Deploy a branch containing the deployment files and provide Git authentication for a private repository. The Compose service uses `pull_policy: build`, allowing a new deployment to rebuild the frontend with the supplied variables while reusing unchanged build layers.

For an Agent or remote Docker setup where source builds are unsupported, publish the image first and use a Stack that references the built image.

## References

- [Vite environment variables and build-time replacement](https://vite.dev/guide/env-and-mode)
- [Docker Compose build arguments](https://docs.docker.com/reference/compose-file/build/#args)
- [Portainer Git repository stacks](https://docs.portainer.io/user/docker/stacks/add#option-3-git-repository)
- [Portainer remote build limitations](https://docs.portainer.io/faqs/known-issues/docker-compose-files-including-build-steps-fail)
