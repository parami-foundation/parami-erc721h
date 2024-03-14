import { ethers, run } from "hardhat";

async function main() {
  const address = "0xea9e7C4BeE7ED126F7870408C4d7A0FDbF4D7203";

  console.log(`Verifying contract on Etherscan...`);

  await run(`verify:verify`, {
    address: address,
    constructorArguments: ["AIME:Kai", "KK", "https://aime.mypinata.cloud/ipfs/QmQvLEz43RH8oz1wnH7P7s9LTfqbm3pVgR9yAuUifUpKFZ", "Some guy named Kai", "https://aime.mypinata.cloud/ipfs/QmQvLEz43RH8oz1wnH7P7s9LTfqbm3pVgR9yAuUifUpKFZ", "0x98dCf0F98fC1ADd4fd7813Ed8466a2E2C53eb28D", "2000000000000000000000"]
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
