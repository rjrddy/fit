FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
FROM node:22-bookworm-slim
WORKDIR /app
ENV HOST=0.0.0.0 PORT=18124 FIT_DB=/data/fit.sqlite NODE_ENV=production
COPY --from=build /app/dist-node ./dist-node
COPY --from=build /app/dist-web ./dist-web
COPY --from=build /app/data ./data
COPY --from=build /app/docs/results/benchmark.json ./docs/results/benchmark.json
RUN mkdir /data && chown node:node /data
USER node
EXPOSE 18124
CMD ["node","dist-node/src/server.js"]
