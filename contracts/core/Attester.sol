// SPDX-License-Identifier: MIT
pragma solidity ^0.8.14;
import '@openzeppelin/contracts/access/Ownable.sol';
import {IAttester} from './interfaces/IAttester.sol';
import {IAttestationsRegistry} from './interfaces/IAttestationsRegistry.sol';
import {Request, Attestation, AttestationData} from './libs/Structs.sol';

/**
 * @title Attester Abstract Contract
 * @author Kleoverse - Forked from Sismo Protocol
 * @notice Contract to be inherited by Attesters
 * All attesters that expect to be authorized in Proof of Talent Protocol (i.e write access on the registry)
 * are recommended to implemented this abstract contract

 * Take a look at the HydraS1SimpleAttester.sol for example on how to implement this abstract contract
 *
 * This contracts is built around two main external standard functions.
 * They must NOT be override them, unless your really know what you are doing
 
 * - generateAttestations(request, proof) => will write attestations in the registry
 * 1. (MANDATORY) Implement the buildAttestations() view function which generate attestations from user request
 * 2. (MANDATORY) Implement teh _verifyRequest() internal function where to write checks
 * 3. (OPTIONAL)  Override _beforeRecordAttestations and _afterRecordAttestations hooks

 * - deleteAttestations(collectionId, owner, proof) => will delete attestations in the registry
 * 1. (DEFAULT)  By default this function throws (see _verifyAttestationsDeletionRequest)
 * 2. (OPTIONAL) Override the _verifyAttestationsDeletionRequest so it no longer throws
 * 3. (OPTIONAL) Override _beforeDeleteAttestations and _afterDeleteAttestations hooks

 * For more information: https://attesters.docs.sismo.io
 **/
abstract contract Attester is IAttester, Ownable {
  // Registry where all attestations are stored
  IAttestationsRegistry internal immutable ATTESTATIONS_REGISTRY;
  // The deployed contract will need to be authorized to write into the Attestation registry
  // It should get write access on attestation collections from AUTHORIZED_COLLECTION_ID_FIRST to AUTHORIZED_COLLECTION_ID_LAST.
  uint256 public immutable AUTHORIZED_COLLECTION_ID_FIRST;
  uint256 public immutable AUTHORIZED_COLLECTION_ID_LAST;
  mapping(uint256 => uint64) internal _badgeMintingPrice;

  /**
   * @dev Constructor
   * @param attestationsRegistryAddress The address of the AttestationsRegistry contract storing attestations
   */
  constructor(
    address attestationsRegistryAddress,
    uint256 collectionIdFirst,
    uint256 collectionIdLast
  ) Ownable() {
    ATTESTATIONS_REGISTRY = IAttestationsRegistry(attestationsRegistryAddress);
    AUTHORIZED_COLLECTION_ID_FIRST = collectionIdFirst;
    AUTHORIZED_COLLECTION_ID_LAST = collectionIdLast;
  }

  /**
   * @dev Main external function. Allows to generate attestations by making a request and submitting proof
   * @param request User request
   * @param proofData Data sent along the request to prove its validity
   * @return attestations Attestations that has been recorded
   */
  function generateAttestations(Request calldata request, bytes calldata proofData)
    external
    payable
    override
    returns (Attestation[] memory)
  {
    // Verify if request is valid by verifying against proof
    _verifyRequest(request, proofData);
    uint256 attestationCollectionId = AUTHORIZED_COLLECTION_ID_FIRST + request.claims[0].groupId;
    _verifyBadgePayment(attestationCollectionId);

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
    address[] memory attestationOwners = new address[](collectionIds.length);
    uint256[] memory attestationCollectionIds = new uint256[](collectionIds.length);
    Attestation[] memory attestationsToDelete = new Attestation[](collectionIds.length);
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

  function setBadgeMintingPrice(uint256[] memory collectionIds, uint64[] memory priceList)
    external
    onlyOwner
  {
    if (collectionIds.length != priceList.length) {
      revert LengthMismatch('colletionIds vs priceList');
    }
    for (uint256 i = 0; i < collectionIds.length; i++) {
      _setBadgeMintingPrice(collectionIds[i], priceList[i]);
    }
  }

  function _setBadgeMintingPrice(uint256 collectionId, uint64 price) internal {
    if (
      collectionId < AUTHORIZED_COLLECTION_ID_FIRST || collectionId > AUTHORIZED_COLLECTION_ID_LAST
    ) {
      revert CollectionIdOutOfBound(collectionId);
    }
    _badgeMintingPrice[collectionId] = price;
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

  function _verifyBadgePayment(uint256 collectionId) internal view {
    if (_badgeMintingPrice[collectionId] > 0 && msg.value != _badgeMintingPrice[collectionId]) {
      revert InsufficientMintingPrice(_badgeMintingPrice[collectionId], msg.value);
    }
  }

  function withdrawFees() external onlyOwner {
    payable(msg.sender).transfer(address(this).balance);
  }

  function getBadgeMintingPrice(uint256 collectionId) external view returns (uint64) {
    return _badgeMintingPrice[collectionId];
  }
}
