// SPDX-License-Identifier: MIT
pragma solidity ^0.8.14;

struct GithubGroupProperties {
  uint128 groupIndex;
  uint32 generationTimestamp;
  string accountId;
}

struct MerkleProofData {
  bytes32[] path;
  string accountId;
  uint256 identityAttestationId;
}

struct IdentityGroupProperties {
  uint128 groupIndex;
  uint32 generationTimestamp;
  string identityType;
  string accountId;
  string username;
}
