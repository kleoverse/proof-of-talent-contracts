// SPDX-License-Identifier: MIT
pragma solidity ^0.8.14;

import {ERC721} from '@openzeppelin/contracts/token/ERC721/ERC721.sol';
import '@openzeppelin/contracts/access/Ownable.sol';

contract MockERC721 is ERC721, Ownable {
  uint32 immutable SKILL_POINTS;

  constructor(
    string memory name,
    string memory symbol,
    uint32 skillPoints
  ) ERC721(name, symbol) {
    SKILL_POINTS = skillPoints;
  }

  function balanceOf(address account) public view virtual override returns (uint256) {
    return SKILL_POINTS;
  }
}
