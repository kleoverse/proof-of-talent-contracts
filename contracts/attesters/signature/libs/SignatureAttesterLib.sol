// SPDX-License-Identifier: MIT
pragma solidity ^0.8.14;

struct SignatureGroupProperties {
  uint128 groupIndex;
  uint32 generationTimestamp;
  string badgeType; // identity, credential, skill
  string source; // github, discord...
  bytes badgeData;
}

struct EIP712Signature {
  uint8 v;
  bytes32 r;
  bytes32 s;
  uint256 deadline;
}
