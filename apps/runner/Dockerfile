FROM node:22-slim

# Install tar and other essentials
RUN apt-get update && apt-get install -y tar curl && rm -rf /var/lib/apt/lists/*

WORKDIR /home/app

# Copy runner source
COPY package*.json ./
RUN npm install

COPY index.ts ./

# We use tsx to run the runner logic
ENTRYPOINT ["npm", "start"]
