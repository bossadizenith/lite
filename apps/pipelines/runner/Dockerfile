FROM node:22-slim

RUN apt-get update && apt-get install -y --no-install-recommends tar curl && rm -rf /var/lib/apt/lists/*

RUN npm install -g pnpm yarn bun


WORKDIR /home/app

COPY package*.json ./
RUN npm install

COPY index.ts ./

ENTRYPOINT ["npm", "start"]
