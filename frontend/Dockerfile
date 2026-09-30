# Frontend service (I-24: a Dockerfile per service). Node.js LTS pinned.
FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

EXPOSE 5173

# The Vite dev server; `--host` is also set in vite.config.ts.
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
