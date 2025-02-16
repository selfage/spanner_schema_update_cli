FROM node:20.12.1

WORKDIR /app
COPY package.json .
COPY package-lock.json .
COPY main_bin.js .
RUN npm install --production
