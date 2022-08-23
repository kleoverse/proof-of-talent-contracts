// SPDX-License-Identifier: MIT
pragma solidity ^0.8.14;

import {ERC1155} from '@openzeppelin/contracts/token/ERC1155/ERC1155.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import {IAttestationsRegistry} from '../../core/interfaces/IAttestationsRegistry.sol';

contract SkillBadge is ERC1155, Ownable {
  error LengthMismatch(uint256[] credIds, uint32[] weights);
  struct SkillData {
    uint256[] credIds;
    mapping(uint256 => uint32) credsToWeights;
    mapping(uint256 => bool) credIdExists;
  }
  IAttestationsRegistry immutable ATTESTATIONS_REGISTRY;
  mapping(uint256 => SkillData) skills;

  constructor(address attestationsRegistryAddress, string memory uri) ERC1155(uri) {
    ATTESTATIONS_REGISTRY = IAttestationsRegistry(attestationsRegistryAddress);
  }

  function balanceOf(address account, uint256 id) public view virtual override returns (uint256) {
    uint256 skillPoints;
    for (uint256 i = 0; i < skills[id].credIds.length; i++) {
      uint256 credId = skills[id].credIds[i];
      skillPoints +=
        ATTESTATIONS_REGISTRY.getAttestationValue(credId, account) *
        skills[id].credsToWeights[credId];
    }
    return skillPoints;
  }

  function setSkillData(
    uint256 id,
    uint256[] memory credIds,
    uint32[] memory weights
  ) public onlyOwner {
    if (credIds.length != weights.length) revert LengthMismatch(credIds, weights);

    for (uint256 i = 0; i < credIds.length; i++) {
      uint256 credId = credIds[i];
      skills[id].credsToWeights[credId] = weights[i];
      if (!skills[id].credIdExists[credId]) {
        skills[id].credIds.push(credId);
        skills[id].credIdExists[credId] = true;
      }
    }
  }

  function getSkillToCredWeight(uint256 id, uint256 credId) public view returns (uint32) {
    return skills[id].credsToWeights[credId];
  }
}
