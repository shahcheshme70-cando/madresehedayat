# مدرسهٔ هدایت — وب (React) پشت nginx
# زمینهٔ ساخت: ریشهٔ مخزن  →  docker build -f apps/web/Dockerfile .
ARG NODE_IMAGE=node:22-alpine
ARG NGINX_IMAGE=nginx:1.27-alpine

FROM ${NODE_IMAGE} AS build
ARG NPM_REGISTRY=https://registry.npmjs.org/
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm config set registry ${NPM_REGISTRY} && npm ci --workspace apps/web --include-workspace-root=false --no-audit --no-fund
COPY apps/web apps/web
RUN npm run build -w apps/web

FROM ${NGINX_IMAGE}
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
