import * as dotenv from "dotenv";

import { HardhatUserConfig, task } from "hardhat/config";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";
import "hardhat-contract-sizer";
import "@openzeppelin/hardhat-upgrades";

dotenv.config();

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

const config: HardhatUserConfig = {
  paths: {
    sources: "./contracts/aime",
    // other paths...
  },
  solidity: {
    version: "0.8.23",
    settings: {
      optimizer: {
        enabled: true,
        runs: 1_000_000,
      },
      metadata: {
        bytecodeHash: "none",
      },
    },
  },
  networks: {
    mainnet: {
      url: `https://mainnet.infura.io/v3/${process.env.INFURA_API_KEY}`,
      accounts:
        process.env.MAINNET_PRIVATE_KEY !== undefined
          ? [process.env.MAINNET_PRIVATE_KEY]
          : [],
    },
    optimism: {
      url: `https://optimism-mainnet.infura.io/v3/${process.env.INFURA_API_KEY}`,
      accounts:
        process.env.TESTNET_PRIVATE_KEY_AIME_TEST !== undefined
          ? [process.env.TESTNET_PRIVATE_KEY_AIME_TEST]
          : [],
    },
    goerli: {
      url: `https://goerli.infura.io/v3/${process.env.INFURA_API_KEY}`,
      accounts:
        process.env.TESTNET_PRIVATE_KEY !== undefined
          ? [process.env.TESTNET_PRIVATE_KEY]
          : [],
    },
    sepolia: {
      url: `https://sepolia.infura.io/v3/${process.env.INFURA_API_KEY}`,
      accounts:
        process.env.TESTNET_PRIVATE_KEY !== undefined
          ? [process.env.TESTNET_PRIVATE_KEY]
          : [],
    },
    scrollSepolia: {
      url: "https://sepolia-rpc.scroll.io/" || "",
      accounts:
        process.env.TESTNET_PRIVATE_KEY_AIME_TEST !== undefined
          ? [process.env.TESTNET_PRIVATE_KEY_AIME_TEST]
          : [],
    },
    arbitrumOne: {
      url: "https://arb1.arbitrum.io/rpc",
      accounts:
        process.env.TESTNET_PRIVATE_KEY_AIME_TEST !== undefined
          ? [process.env.TESTNET_PRIVATE_KEY_AIME_TEST]
          : [],
    },
    localhost: {
      url: `http://localhost:8545`,
      accounts: [
        "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
      ],
    },
    hardhat: {},
  },
  gasReporter: {
    enabled: true,
    currency: "USD",
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
    customChains: [
      {
        network: "scrollSepolia",
        chainId: 534351,
        urls: {
          apiURL: "https://sepolia-blockscout.scroll.io/api",
          browserURL: "https://sepolia-blockscout.scroll.io/",
        },
      },
    ],
  },
  contractSizer: {
    alphaSort: true,
    disambiguatePaths: false,
    runOnCompile: true,
    strict: true,
    only: [""],
  },
};

export default config;
