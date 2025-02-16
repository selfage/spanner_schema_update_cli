FROM node:20.12.1

WORKDIR /app
COPY package.json .
COPY package-lock.json .
COPY bin/main_bin.js .
RUN npm install --production

ENTRYPOINT ["node", "main_bin.js"]
