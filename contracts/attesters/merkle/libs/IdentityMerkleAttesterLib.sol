// SPDX-License-Identifier: MIT
pragma solidity ^0.8.14;

struct IdentityMerkleGroupProperties {
  uint128 groupIndex;
  uint32 generationTimestamp;
  string accountId;
}

struct MerkleProofData {
  bytes32[] path;
  string accountId;
  uint256 identityAttestationId;
}

struct IdentityBadgeData {
  string accountId;
  string username;
}

struct IdentityGroupProperties {
  uint128 groupIndex;
  uint32 generationTimestamp;
  string badgeType; // identity, credential
  string source; // github, discord...
  bytes badgeData;
}
