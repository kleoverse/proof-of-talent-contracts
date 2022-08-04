// SPDX-License-Identifier: MIT
pragma solidity ^0.8.14;

import {IAttesterOracle} from './interfaces/IAttesterOracle.sol';
import {IAttestationsRegistry} from './interfaces/IAttestationsRegistry.sol';
import {Request, Attestation, AttestationData} from './libs/Structs.sol';
import {AccessControl} from '@openzeppelin/contracts/access/AccessControl.sol';

/**
 * @title Attester Oracle Abstract Contract
 * @author Sahil Vasava
 * @notice Contract to be inherited by Attesters
 * All oracle attesters that expect to be authorized in Proof of Talent Protocol (i.e write access on the registry)
 * are recommended to implemented this abstract contract

 * Take a look at the GithubAttester.sol for example on how to implement this abstract contract
 *
 **/
abstract contract AttesterOracle is IAttesterOracle, AccessControl {
  // Registry where all attestations are stored
  IAttestationsRegistry internal immutable ATTESTATIONS_REGISTRY;
  bytes32 public constant ATTESTER_ORACLE_ROLE = keccak256('ATTESTER_ORACLE_ROLE');

  /**
   * @dev Constructor
   * @param attestationsRegistryAddress The address of the AttestationsRegistry contract storing attestations
   */
  constructor(
    address owner,
    address attestationsRegistryAddress,
    address attesterOracle
  ) {
    ATTESTATIONS_REGISTRY = IAttestationsRegistry(attestationsRegistryAddress);
    _grantRole(DEFAULT_ADMIN_ROLE, owner);
    _grantRole(ATTESTER_ORACLE_ROLE, attesterOracle);
  }

  /**
   * @dev Main external function. Allows to generate attestations by making a request and submitting proof
   * @param request User request
   * @param proofData Data sent along the request to prove its validity
   * @return attestations Attestations that has been recorded
   */
  function generateAttestations(Request calldata request, bytes calldata proofData)
    external
    override
    onlyRole(ATTESTER_ORACLE_ROLE)
    returns (Attestation[] memory)
  {
    // Verify if request is valid by verifying against proof
    _verifyRequest(request, proofData);

    // Generate the actual attestations from user request
    Attestation[] memory attestations = buildAttestations(request, proofData);

    _beforeRecordAttestations(request, proofData);

    ATTESTATIONS_REGISTRY.recordAttestations(attestations);

    _afterRecordAttestations(attestations);

    for (uint256 i = 0; i < attestations.length; i++) {
      emit AttestationGenerated(attestations[i]);
    }

    return attestations;
  }

  function requestVerifyRequestCallback(Request calldata request) external {
    emit VerifyRequest(request, msg.sender);
  }

  /**
   * @dev External facing function. Allows to delete attestations by submitting proof
   * @param collectionIds Collection identifier of attestations to delete
   * @param attestationsOwner Owner of attestations to delete
   * @param proofData Data sent along the deletion request to prove its validity
   * @return attestations Attestations that were deleted
   */
  function deleteAttestations(
    uint256[] calldata collectionIds,
    address attestationsOwner,
    bytes calldata proofData
  ) external override returns (Attestation[] memory) {
    // fetch attestations from the registry
    address[] memory attestationOwners;
    uint256[] memory attestationCollectionIds;
    Attestation[] memory attestationsToDelete;
    for (uint256 i = 0; i < collectionIds.length; i++) {
      (
        address issuer,
        uint256 attestationValue,
        uint32 timestamp,
        bytes memory extraData
      ) = ATTESTATIONS_REGISTRY.getAttestationDataTuple(collectionIds[i], attestationsOwner);

      attestationOwners[i] = attestationsOwner;
      attestationCollectionIds[i] = collectionIds[i];

      attestationsToDelete[i] = (
        Attestation(
          collectionIds[i],
          attestationsOwner,
          issuer,
          attestationValue,
          timestamp,
          extraData
        )
      );
    }

    _verifyAttestationsDeletionRequest(attestationsToDelete, proofData);

    _beforeDeleteAttestations(attestationsToDelete, proofData);

    ATTESTATIONS_REGISTRY.deleteAttestations(attestationOwners, attestationCollectionIds);

    _afterDeleteAttestations(attestationsToDelete, proofData);

    for (uint256 i = 0; i < collectionIds.length; i++) {
      emit AttestationDeleted(attestationsToDelete[i]);
    }
    return attestationsToDelete;
  }

  /**
   * @dev MANDATORY: must be implemented in attesters
   * It should build attestations from the user request and the proof
   * @param request User request
   * @param proofData Data sent along the request to prove its validity
   * @return attestations Attestations that will be recorded
   */
  function buildAttestations(Request calldata request, bytes calldata proofData)
    public
    view
    virtual
    returns (Attestation[] memory);

  /**
   * @dev Attestation registry getter
   * @return attestationRegistry
   */
  function getAttestationRegistry() external view override returns (IAttestationsRegistry) {
    return ATTESTATIONS_REGISTRY;
  }

  /**
   * @dev MANDATORY: must be implemented in attesters
   * It should verify the user request is valid
   * @param request User request
   * @param proofData Data sent along the request to prove its validity
   */
  function _verifyRequest(Request calldata request, bytes calldata proofData) internal virtual;

  /**
   * @dev Optional: must be overridden by attesters that want to feature attestations deletion
   * Default behavior: throws
   * It should verify attestations deletion request is valid
   * @param attestations Attestations that will be deleted
   * @param proofData Data sent along the request to prove its validity
   */
  function _verifyAttestationsDeletionRequest(
    Attestation[] memory attestations,
    bytes calldata proofData
  ) internal virtual {
    revert AttestationDeletionNotImplemented();
  }

  /**
   * @dev Optional: Hook, can be overridden in attesters
   * Will be called before recording attestations in the registry
   * @param request User request
   * @param proofData Data sent along the request to prove its validity
   */
  function _beforeRecordAttestations(Request calldata request, bytes calldata proofData)
    internal
    virtual
  {}

  /**
   * @dev (Optional) Can be overridden in attesters inheriting this contract
   * Will be called after recording an attestation
   * @param attestations Recorded attestations
   */
  function _afterRecordAttestations(Attestation[] memory attestations) internal virtual {}

  /**
   * @dev Optional: Hook, can be overridden in attesters
   * Will be called before deleting attestations from the registry
   * @param attestations Attestations to delete
   * @param proofData Data sent along the deletion request to prove its validity
   */
  function _beforeDeleteAttestations(Attestation[] memory attestations, bytes calldata proofData)
    internal
    virtual
  {}

  /**
   * @dev Optional: Hook, can be overridden in attesters
   * Will be called after deleting attestations from the registry
   * @param attestations Attestations to delete
   * @param proofData Data sent along the deletion request to prove its validity
   */
  function _afterDeleteAttestations(Attestation[] memory attestations, bytes calldata proofData)
    internal
    virtual
  {}
}