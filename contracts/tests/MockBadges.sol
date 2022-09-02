// SPDX-License-Identifier: MIT
pragma solidity ^0.8.14;

import {ERC1155} from '@openzeppelin/contracts/token/ERC1155/ERC1155.sol';

contract MockBadges is ERC1155 {
  uint32 immutable SKILL_POINTS;

  constructor(string memory uri, uint32 skillPoints) ERC1155(uri) {
    SKILL_POINTS = skillPoints;
  }

  function balanceOf(address account, uint256 id) public view virtual override returns (uint256) {
    return SKILL_POINTS;
  }
}
