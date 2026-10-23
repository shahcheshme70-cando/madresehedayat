# مدرسهٔ هدایت — API (NestJS)
# زمینهٔ ساخت: ریشهٔ مخزن  →  docker build -f apps/api/Dockerfile .
# اگر Docker Hub از سرور در دسترس نیست، NODE_IMAGE را به آینهٔ داخلی بدهید (README).
ARG NODE_IMAGE=node:22-alpine

FROM ${NODE_IMAGE} AS build
ARG NPM_REGISTRY=https://registry.npmjs.org/
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm config set registry ${NPM_REGISTRY} && npm ci --workspace apps/api --include-workspace-root=false --no-audit --no-fund
COPY apps/api apps/api
RUN npm run build -w apps/api && npm prune --omit=dev --workspace apps/api --no-audit --no-fund

FROM ${NODE_IMAGE}
ENV NODE_ENV=production PORT=3000
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/drizzle ./apps/api/drizzle
COPY --from=build /app/apps/api/package.json ./apps/api/
WORKDIR /app/apps/api
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --retries=5 CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
# مهاجرت پایگاه داده و دادهٔ پایه هر بار اجرا می‌شود (بی‌خطر و تکرارپذیر)، بعد خود برنامه
CMD ["sh", "-c", "node dist/db/migrate.js && node dist/db/seed.js && node dist/main.js"]
