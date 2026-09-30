# Sudoku Arena — backend image (Unit 01 foundation).
# A Dockerfile per service is decided (BLD-016 / I-24); the same image is used
# in development and in deployment, so the two developers cannot drift apart.

FROM node:22-bookworm-slim

# Prisma needs OpenSSL in the runtime image.
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies first so the layer is cached when only source changes.
COPY package.json package-lock.json* ./
RUN npm install

# Prisma schema + migrations (the schema is the single source of truth, I-31).
COPY prisma ./prisma
RUN npx prisma generate

COPY . .

EXPOSE 3000

# Development default; Compose overrides the command to run migrations first.
CMD ["npm", "run", "dev"]
