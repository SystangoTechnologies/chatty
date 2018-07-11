FROM node:8.11.0

RUN mkdir -p /src/app

WORKDIR /src/app

COPY package.json /src/app

COPY . /src/app

RUN npm install

RUN npm install -g forever