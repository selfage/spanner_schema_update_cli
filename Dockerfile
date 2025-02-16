FROM node:20.12.1

WORKDIR /app
COPY package.json .
COPY package-lock.json .
COPY bin/ .
RUN npm install --production

ENTRYPOINT ["node", "main_bin"]
