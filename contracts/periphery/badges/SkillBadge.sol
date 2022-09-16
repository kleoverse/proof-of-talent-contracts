// SPDX-License-Identifier: MIT
pragma solidity ^0.8.14;

import {ERC1155} from '@openzeppelin/contracts/token/ERC1155/ERC1155.sol';
import {Initializable} from '@openzeppelin/contracts/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import {IAttestationsRegistry} from '../../core/interfaces/IAttestationsRegistry.sol';
import {IERC1155} from '@openzeppelin/contracts/token/ERC1155/IERC1155.sol';
import {IERC721} from '@openzeppelin/contracts/token/ERC721/IERC721.sol';

contract SkillBadge is Initializable, ERC1155, Ownable {
  error LengthMismatch(uint256[] credIds, uint32[] weights);

  event SkillDataSet(
    uint256 indexed id,
    uint256[] credIds,
    address[] addresses,
    ContractType[] contractTypes,
    uint32[] weights
  );

  enum ContractType {
    ERC721,
    ERC1155
  }

  struct SkillData {
    uint256[] credIds;
    address[] addresses;
    ContractType[] contractTypes;
    mapping(address => mapping(uint256 => uint32)) contractsToCredsToWeights;
    mapping(address => mapping(uint256 => bool)) credIdExists;
  }
  mapping(uint256 => SkillData) skills;

  constructor(string memory uri) ERC1155(uri) {
    initialize(uri);
  }

  /**
   * @dev Initializes the contract, to be called by the proxy delegating calls to this implementation
   * @param uri Uri for the metadata of badges
   */
  function initialize(string memory uri) public initializer {
    _setURI(uri);
    _transferOwnership(_msgSender());
  }

  /**
   * @dev Get the skillPoints stored as balance of account for skill id
   * @param account Address of which skillPoints is to be checked
   * @param id skill token id for which to get skillPoints
   * @return SkillPoints of the account for skill id
   */
  function balanceOf(address account, uint256 id) public view virtual override returns (uint256) {
    uint256 skillPoints;
    for (uint256 i = 0; i < skills[id].credIds.length; i++) {
      uint256 credId = skills[id].credIds[i];
      address _address = skills[id].addresses[i];
      ContractType _cType = skills[id].contractTypes[i];
      if (_cType == ContractType.ERC1155) {
        skillPoints +=
          IERC1155(_address).balanceOf(account, credId) *
          skills[id].contractsToCredsToWeights[_address][credId];
      } else {
        skillPoints +=
          IERC721(_address).balanceOf(account) *
          skills[id].contractsToCredsToWeights[_address][credId];
      }
    }
    return skillPoints;
  }

  /**
   * @dev Set weights and other cred badge data for a single skill id
   * @param id skill token id for which to set the data
   * @param credIds An array of token ids of creds in case of ERC1155 tokens
   * @param addresses An array of addresses of creds
   * @param contractTypes An array of token types (ERC721/ERC1155) of creds
   * @param weights An array of weights of creds for the skill id
   */
  function setSkillData(
    uint256 id,
    uint256[] memory credIds,
    address[] memory addresses,
    ContractType[] memory contractTypes,
    uint32[] memory weights
  ) public onlyOwner {
    if (credIds.length != weights.length) revert LengthMismatch(credIds, weights);

    for (uint256 i = 0; i < credIds.length; i++) {
      uint256 credId = credIds[i];
      address _address = addresses[i];
      ContractType _cType = contractTypes[i];
      skills[id].contractsToCredsToWeights[_address][credId] = weights[i];
      if (!skills[id].credIdExists[_address][credId]) {
        skills[id].credIds.push(credId);
        skills[id].addresses.push(_address);
        skills[id].contractTypes.push(_cType);
        skills[id].credIdExists[_address][credId] = true;
      }
    }
    emit SkillDataSet(id, credIds, addresses, contractTypes, weights);
  }

  /**
   * @dev Get cred weight for a single skill id
   * @param id skill token id for which to get the weight
   * @param _address address of cred
   * @param credId token ids of cred in case of ERC1155 tokens, 0 in case of ERC721 token
   * @return Weight of the cred for skill id
   */
  function getSkillToCredWeight(
    uint256 id,
    address _address,
    uint256 credId
  ) public view returns (uint32) {
    return skills[id].contractsToCredsToWeights[_address][credId];
  }

  /**
   * @dev Get cred data for a single skill id
   * @param id skill token id for which to get the weight
   * @return cred data tuple (credIds, addresses, contractTypes) for skill id
   */
  function getSkillToCredData(uint256 id)
    public
    view
    returns (
      uint256[] memory,
      address[] memory,
      ContractType[] memory
    )
  {
    return (skills[id].credIds, skills[id].addresses, skills[id].contractTypes);
  }
}
