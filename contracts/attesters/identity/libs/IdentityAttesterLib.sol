// SPDX-License-Identifier: MIT
pragma solidity ^0.8.14;

struct IdentityGroupProperties {
  uint128 groupIndex;
  uint32 generationTimestamp;
  string accountId;
  string username;
  string identityType;
}

struct EIP712Signature {
  uint8 v;
  bytes32 r;
  bytes32 s;
  uint256 deadline;
}
