FROM node:latest

WORKDIR /app

# clone the contract code repository
RUN git clone https://github.com/parami-foundation/parami-erc721h.git

WORKDIR /app/parami-erc721h

# install hardhat and required dependencies
RUN npm install

COPY ./docker-entrypoint.sh /app/parami-erc721h/docker-entrypoint.sh
COPY ./scripts /app/parami-erc721h/scripts
RUN chmod +x /app/parami-erc721h/docker-entrypoint.sh

CMD [ "./docker-entrypoint.sh" ]