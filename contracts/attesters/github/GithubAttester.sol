// SPDX-License-Identifier: MIT

pragma solidity ^0.8.14;
pragma experimental ABIEncoderV2;

import '@openzeppelin/contracts/utils/cryptography/draft-EIP712.sol';
// Core protocol Protocol imports
import {IGithubAttester} from './interfaces/IGithubAttester.sol';
import {Request, Attestation, Claim} from './../../core/libs/Structs.sol';
import {Attester, IAttester, IAttestationsRegistry} from './../../core/Attester.sol';
import {GithubGroupProperties, EIP712Signature} from './libs/GithubAttesterLib.sol';

contract GithubAttester is IGithubAttester, Attester, EIP712 {
  bytes32 private constant _ATTESTATION_REQUEST_TYPEHASH =
    keccak256(
      'AttestationRequest(uint256 groupId,uint256 claimedValue,bytes extraData,address destination,uint256 deadline)'
    );

  // The deployed contract will need to be authorized to write into the Attestation registry
  // It should get write access on attestation collections from AUTHORIZED_COLLECTION_ID_FIRST to AUTHORIZED_COLLECTION_ID_LAST.
  uint256 public immutable AUTHORIZED_COLLECTION_ID_FIRST;
  uint256 public immutable AUTHORIZED_COLLECTION_ID_LAST;
  address internal _verifierAddress;

  /*******************************************************
    INITIALIZATION FUNCTIONS                           
  *******************************************************/
  /**
   * @dev Constructor. Initializes the contract
   * @param attestationsRegistryAddress Attestations Registry contract on which the attester will write attestations
   * @param collectionIdFirst Id of the first collection in which the attester is supposed to record
   * @param collectionIdLast Id of the last collection in which the attester is supposed to record
   */
  constructor(
    address attestationsRegistryAddress,
    uint256 collectionIdFirst,
    uint256 collectionIdLast,
    address verifierAddress
  ) Attester(attestationsRegistryAddress) EIP712('GithubAttester', '1') {
    AUTHORIZED_COLLECTION_ID_FIRST = collectionIdFirst;
    AUTHORIZED_COLLECTION_ID_LAST = collectionIdLast;
    _verifierAddress = verifierAddress;
  }

  /*******************************************************
    MANDATORY FUNCTIONS TO OVERRIDE FROM ATTESTER.SOL
  *******************************************************/

  /**
   * @dev Throws if user request is invalid when verified against
   * @param request users request. Claim of having met the badge requirement
   * @param proofData Signature proof
   */
  function _verifyRequest(Request calldata request, bytes calldata proofData)
    internal
    virtual
    override
  {
    EIP712Signature memory sig = abi.decode(proofData, (EIP712Signature));
    if (sig.deadline < block.timestamp) {
      revert SignatureDeadlineExpired(sig.deadline);
    }
    bytes32 structHash = keccak256(
      abi.encode(
        _ATTESTATION_REQUEST_TYPEHASH,
        request.claims[0].groupId,
        request.claims[0].claimedValue,
        keccak256(request.claims[0].extraData),
        request.destination,
        sig.deadline
      )
    );

    bytes32 hash = _hashTypedDataV4(structHash);

    address signer = ECDSA.recover(hash, sig.v, sig.r, sig.s);
    if (signer != _verifierAddress) {
      revert SignatureInvalid(_verifierAddress, signer);
    }
  }

  /**
   * @dev Returns attestations that will be recorded, constructed from the user request
   * @param request users request. Claim of having met the badge requirement
   */
  function buildAttestations(Request calldata request, bytes calldata)
    public
    view
    virtual
    override(Attester)
    returns (Attestation[] memory)
  {
    Claim memory claim = request.claims[0];
    GithubGroupProperties memory groupProperties = abi.decode(
      claim.extraData,
      (GithubGroupProperties)
    );

    Attestation[] memory attestations = new Attestation[](1);

    uint256 attestationCollectionId = AUTHORIZED_COLLECTION_ID_FIRST + claim.groupId;

    address issuer = address(this);

    attestations[0] = Attestation(
      attestationCollectionId,
      request.destination,
      issuer,
      claim.claimedValue,
      groupProperties.generationTimestamp,
      ''
    );
    return (attestations);
  }

  /*******************************************************
    OPTIONAL HOOK VIRTUAL FUNCTIONS FROM ATTESTER.SOL
  *******************************************************/

  /**
   * @dev Hook run before recording the attestation.
   * Throws if ticket already used and not a renewal (e.g destination different that last)
   * @param request users request. Claim of having an account part of a group of accounts
   * @param proofData provided to back the request. snark input and snark proof
   */
  function _beforeRecordAttestations(Request calldata request, bytes calldata proofData)
    internal
    virtual
    override
  {}
}
