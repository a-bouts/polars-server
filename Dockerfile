FROM node

WORKDIR /polars-server

COPY . .

RUN yarn install

ENTRYPOINT ["node", "polars-server.js"]
