// SPDX-License-Identifier: MIT
pragma solidity ^0.8.14;

interface IDataMigratableAttester {
  function getDestinationOfSource(uint256 attestationId, address source)
    external
    view
    returns (address);

  function setDestinationForSource(
    uint256 attestationId,
    address source,
    address destination
  ) external;
}
