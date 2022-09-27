// SPDX-License-Identifier: MIT
pragma solidity ^0.8.14;

struct SkillGroupProperties {
  uint128 groupIndex;
  uint32 generationTimestamp;
  string badgeType; // identity, credential, skill
  string source; // github, discord, other...
  bytes badgeData;
}
