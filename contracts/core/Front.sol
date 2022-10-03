// SPDX-License-Identifier: MIT
pragma solidity ^0.8.14;

import {IFront} from './interfaces/IFront.sol';
import {IAttester} from './interfaces/IAttester.sol';
import {IAttestationsRegistry} from './interfaces/IAttestationsRegistry.sol';
import {Request, Attestation} from './libs/Structs.sol';

/**
 * @title Front
 * @author Kleoverse - Forked from Sismo Protocol
 * @notice This is the Front contract of the Proof of Talent protocol
 * Behind a proxy, it routes attestations request to the targeted attester and can perform some actions
 */
contract Front is IFront {
  IAttestationsRegistry public immutable ATTESTATIONS_REGISTRY;

  /**
   * @dev Constructor
   * @param attestationsRegistryAddress Attestations registry contract address
   */
  constructor(address attestationsRegistryAddress) {
    ATTESTATIONS_REGISTRY = IAttestationsRegistry(attestationsRegistryAddress);
  }

  /**
   * @dev Forward a request to an attester
   * @param attester Attester targeted by the request
   * @param request Request sent to the attester
   * @param proofData Data provided to the attester to back the request
   */
  function generateAttestations(
    address attester,
    Request calldata request,
    bytes calldata proofData
  ) external override returns (Attestation[] memory) {
    Attestation[] memory attestations = _forwardAttestationsGeneration(
      attester,
      request,
      proofData
    );
    return attestations;
  }

  /**
   * @dev generate multiple attestations at once, to the same destination
   * @param attesters Attesters targeted by the attesters
   * @param requests Requests sent to attester
   * @param proofDataArray Data sent with each request
   */
  function batchGenerateAttestations(
    address[] calldata attesters,
    Request[] calldata requests,
    bytes[] calldata proofDataArray
  ) external override returns (Attestation[][] memory) {
    Attestation[][] memory attestations = new Attestation[][](attesters.length);
    address destination = requests[0].destination;
    for (uint256 i = 0; i < attesters.length; i++) {
      if (requests[i].destination != destination) revert DifferentRequestsDestinations();
      attestations[i] = _forwardAttestationsGeneration(
        attesters[i],
        requests[i],
        proofDataArray[i]
      );
    }
    return attestations;
  }

  /**
   * @dev build the attestations from a user request targeting a specific attester.
   * Forwards to the build function of targeted attester
   * @param attester Targeted attester
   * @param request User request
   * @param proofData Data sent along the request to prove its validity
   * @return attestations Attestations that will be recorded
   */
  function buildAttestations(
    address attester,
    Request calldata request,
    bytes calldata proofData
  ) external view override returns (Attestation[] memory) {
    return _forwardAttestationsBuild(attester, request, proofData);
  }

  /**
   * @dev build the attestations from multiple user requests.
   * Forwards to the build function of targeted attester
   * @param attesters Targeted attesters
   * @param requests User requests
   * @param proofDataArray Data sent along the request to prove its validity
   * @return attestations Attestations that will be recorded
   */
  function batchBuildAttestations(
    address[] calldata attesters,
    Request[] calldata requests,
    bytes[] calldata proofDataArray
  ) external view override returns (Attestation[][] memory) {
    Attestation[][] memory attestations = new Attestation[][](attesters.length);

    for (uint256 i = 0; i < attesters.length; i++) {
      attestations[i] = _forwardAttestationsBuild(attesters[i], requests[i], proofDataArray[i]);
    }
    return attestations;
  }

  function _forwardAttestationsBuild(
    address attester,
    Request calldata request,
    bytes calldata proofData
  ) internal view returns (Attestation[] memory) {
    return IAttester(attester).buildAttestations(request, proofData);
  }

  function _forwardAttestationsGeneration(
    address attester,
    Request calldata request,
    bytes calldata proofData
  ) internal returns (Attestation[] memory) {
    return IAttester(attester).generateAttestations(request, proofData);
  }
}
