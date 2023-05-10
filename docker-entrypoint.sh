#!/bin/sh

# Start the Hardhat Node in the background
npx hardhat node &

# Sleep for a few seconds to allow the Hardhat Node to start
sleep 20

# Deploy the contract
npx hardhat run --network localhost scripts/influencemining/deployAll.ts

# Keep the container running
tail -f /dev/null
