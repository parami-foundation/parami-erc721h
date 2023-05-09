FROM node:latest

WORKDIR /app

# clone the contract code repository
RUN git clone https://github.com/parami-foundation/parami-erc721h.git

WORKDIR /app/parami-erc721h

# install hardhat and required dependencies
RUN npm install

# expose the required ports
EXPOSE 8545 8546

RUN ls -la

# start the hardhat node
CMD ["npx", "hardhat", "node"]