// SPDX-License-Identifier: MIT
pragma solidity ^0.8.14;

import {ERC1155} from '@openzeppelin/contracts/token/ERC1155/ERC1155.sol';
import '@openzeppelin/contracts/access/Ownable.sol';

contract MockSkillBadge is ERC1155, Ownable {
  uint32 immutable SKILL_POINTS;

  constructor(
    address attestationsRegistryAddress,
    string memory uri,
    uint32 skillPoints
  ) ERC1155(uri) {
    SKILL_POINTS = skillPoints;
  }

  function balanceOf(address account, uint256 id) public view virtual override returns (uint256) {
    return SKILL_POINTS;
  }
}
