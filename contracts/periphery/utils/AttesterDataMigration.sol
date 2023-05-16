// SPDX-License-Identifier: MIT
pragma solidity ^0.8.14;

import './interfaces/IDataMigratableAttester.sol';
import {Ownable} from '@openzeppelin/contracts/access/Ownable.sol';

contract AttesterDataMigration is Ownable {
  constructor() {}

  function migrateData(
    address _oldContract,
    address _newContract,
    uint256[] calldata attestationIds,
    address[] calldata sources
  ) external onlyOwner {
    require(
      attestationIds.length == sources.length,
      'DataMigration: attestationIds and sources length mismatch'
    );

    IDataMigratableAttester oldContract = IDataMigratableAttester(_oldContract);
    IDataMigratableAttester newContract = IDataMigratableAttester(_newContract);
    for (uint256 i = 0; i < attestationIds.length; i++) {
      uint256 attestationId = attestationIds[i];
      address source = sources[i];

      address oldDestination = oldContract.getDestinationOfSource(attestationId, source);
      if (oldDestination != address(0)) {
        newContract.setDestinationForSource(attestationId, source, oldDestination);
      }
    }
  }
}
