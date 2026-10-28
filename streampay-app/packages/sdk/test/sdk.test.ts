import test from "node:test";
import assert from "node:assert/strict";
import {
  parseUnits,
  formatUnits,
  ContractError,
  CONTRACT_ERROR_MESSAGES,
  StreamPayClient,
  USDC_DECIMALS,
} from "../dist/index.js";

test("parseUnits converts human units to base stroops", () => {
  assert.equal(parseUnits("1"), 10_000_000n);
  assert.equal(parseUnits("0.1"), 1_000_000n);
  assert.equal(parseUnits("0.0000001"), 1n);
  assert.equal(parseUnits("123.4567890"), 1234567890n);
});

test("formatUnits converts base stroops to human units", () => {
  assert.equal(formatUnits(10_000_000n), "1");
  assert.equal(formatUnits(1_000_000n), "0.1");
  assert.equal(formatUnits(1n), "0.0000001");
  assert.equal(formatUnits(1234567890n), "123.456789");
  assert.equal(formatUnits(0n), "0");
});

test("ContractError maps to informative messages", () => {
  assert.equal(
    StreamPayClient.getErrorMessage(ContractError.InsufficientBalance),
    "Insufficient token balance or allowance to process transfer."
  );
  assert.equal(
    StreamPayClient.getErrorMessage(ContractError.StreamCancelled),
    "Stream has been cancelled and cannot be modified."
  );
  assert.equal(
    StreamPayClient.getErrorMessage(ContractError.InvalidRate),
    "Invalid rate: payment rate must be strictly positive."
  );
});

test("StreamPayClient instance holds correct configuration", () => {
  const client = new StreamPayClient({
    contractId: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM",
    rpcUrl: "https://soroban-testnet.stellar.org",
    networkPassphrase: "Test SDF Network ; September 2015",
  });

  assert.equal(client.contractId, "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM");
  assert.equal(client.rpcUrl, "https://soroban-testnet.stellar.org");
  assert.equal(client.networkPassphrase, "Test SDF Network ; September 2015");
});
