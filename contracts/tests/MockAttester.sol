// SPDX-License-Identifier: MIT

pragma solidity ^0.8.14;

import {Attestation, Request} from '../core/libs/Structs.sol';
import {Attester} from '../core/Attester.sol';
import {IAttester} from '../core/interfaces/IAttester.sol';

contract MockAttester is IAttester, Attester {
  constructor(
    address ATTESTATION_REGISTRY_ADDRESS,
    uint256 collectionIdFirst,
    uint256 collectionIdLast
  ) Attester(ATTESTATION_REGISTRY_ADDRESS, collectionIdFirst, collectionIdLast) {}

  function _verifyRequest(Request calldata request, bytes calldata proofData)
    internal
    virtual
    override
  {}

  function buildAttestations(
    Request calldata request,
    bytes calldata /*data*/
  ) public view virtual override(Attester, IAttester) returns (Attestation[] memory) {
    uint256 collectionId = AUTHORIZED_COLLECTION_ID_FIRST + request.claims[0].groupId;
    Attestation[] memory attestations = new Attestation[](1);
    attestations[0] = Attestation(
      collectionId,
      request.destination,
      address(this),
      request.claims[0].claimedValue,
      abi.decode(request.claims[0].extraData, (uint32)),
      'Mock Attester v0'
    );
    return (attestations);
  }
}
