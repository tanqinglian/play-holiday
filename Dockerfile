FROM node:22-bookworm-slim AS build

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY server/package.json ./server/package.json
RUN pnpm install --frozen-lockfile --filter @play-holiday/server...

COPY server ./server
RUN DATABASE_URL="mysql://build:build@127.0.0.1:3306/build" \
    pnpm --filter @play-holiday/server db:generate \
    && pnpm --filter @play-holiday/server build

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV SERVER_HOST=0.0.0.0
ENV PORT=8080
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

WORKDIR /app
COPY --from=build /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/server/package.json ./server/package.json
COPY --from=build /app/server/node_modules ./server/node_modules
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/server/generated ./server/generated
COPY --from=build /app/server/prisma ./server/prisma
COPY --from=build /app/server/prisma.config.ts ./server/prisma.config.ts

EXPOSE 8080
CMD ["pnpm", "--dir", "server", "start"]
