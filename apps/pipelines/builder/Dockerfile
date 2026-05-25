FROM ubuntu:focal

RUN apt-get update
RUN apt-get install -y curl
RUN curl -sL https://deb.nodesource.com/setup_22.x | bash -
RUN apt-get upgrade -y
RUN apt-get install -y nodejs
RUN npm install -g pnpm yarn bun

RUN apt-get install git -y

WORKDIR /home/app

COPY main.sh main.sh
COPY index.ts index.ts
COPY framework-detection.ts framework-detection.ts
COPY package*.json ./

RUN npm install

RUN chmod +x main.sh

ENTRYPOINT [ "/home/app/main.sh" ]
