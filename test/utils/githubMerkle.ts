import {
  ACCOUNTS_TREE_HEIGHT,
  KVMerkleTree,
  MerklePath,
  MerkleTreeData,
  REGISTRY_TREE_HEIGHT,
} from '@sismo-core/hydra-s1';
import { BigNumber, ethers } from 'ethers';
import { v4 as uuidv4 } from 'uuid';
import { RegistryAccountsMerkle } from '.';
import { MerkleTree } from 'merkletreejs';
import { keccak256 } from 'ethers/lib/utils';

/*************************************************/
/**************    MOCK ACCOUNTS     *************/
/*************************************************/

export type GithubMerkleData = {
  identifier: string;
};

export const generateGithubMerkleAccounts = async (signers): Promise<GithubMerkleData[]> => {
  const accounts: GithubMerkleData[] = [];
  for (const signer of signers) {
    accounts.push({
      identifier: BigNumber.from('0x' + uuidv4().replace(/-/g, '')).toHexString(),
    });
  }
  return accounts;
};

/*************************************************/
/****************    DATA SOURCE     *************/
/*************************************************/

type List = { [address: string]: [value: number] };

export const generateGithubMerkleLists = (Accounts: GithubMerkleData[]): List[] => {
  const List1 = {};
  const List2 = {};
  Accounts.forEach((account, index) => {
    Object.assign(List1, { [BigNumber.from(account.identifier).toHexString()]: index });
    Object.assign(List2, { [BigNumber.from(account.identifier).toHexString()]: index + 1000 });
  });
  return [List1, List2];
};

export type GithubMerkleGroup = {
  data: MerkleTreeData;
  properties: GithubMerkleGroupProperties;
  id: string;
};

export type GithubMerkleGroupProperties = {
  groupIndex: number;
  generationTimestamp: number;
};

export type GithubMerkleRegistryAccountsMerkle = {
  accountsTrees: MerkleTree[];
  registryTree: MerkleTree;
};

export type GithubMerkleAttesterGroups = {
  groups: GithubMerkleGroup[];
  dataFormat: GithubMerkleRegistryAccountsMerkle;
};

export const generateGithubMerkleAttesterGroups = async (
  allList: List[]
): Promise<GithubMerkleAttesterGroups> => {
  /*********************** GENERATE GROUPS *********************/

  const groups: GithubMerkleGroup[] = [];
  let generationTimestamp = Math.round(Date.now() / 1000);

  for (let i = 0; i < allList.length; i++) {
    const properties = {
      groupIndex: i,
      generationTimestamp,
    };

    groups.push({
      data: allList[i],
      properties,
      id: i.toString(),
    });
    generationTimestamp++;
  }

  /************************ FORMAT DATA *********************/

  const accountsTrees: MerkleTree[] = [];
  const registryTreeData: MerkleTreeData = {};

  for (let i = 0; i < groups.length; i++) {
    const leaves = generateLeavesFromData(groups[i].data);
    let _accountsTree = new MerkleTree(leaves, keccak256, { sort: true });
    // let _accountsTree = new KVMerkleTree(groups[i].data, keccak256, ACCOUNTS_TREE_HEIGHT, true);
    accountsTrees.push(_accountsTree);
    registryTreeData[_accountsTree.getRoot().toString('hex')] = groups[i].id;
  }

  const leaves = generateLeavesFromData(registryTreeData);
  let registryTree = new MerkleTree(leaves, keccak256, { sort: true });
  // const registryTree = new KVMerkleTree(registryTreeData, keccak256, REGISTRY_TREE_HEIGHT, true);

  return {
    groups,
    dataFormat: {
      accountsTrees,
      registryTree,
    },
  };
};

export const encodeGithubMerkleGroupProperties = (
  groupProperties: GithubMerkleGroupProperties,
  accountId: string
): string => {
  return ethers.utils.defaultAbiCoder.encode(
    ['uint128', 'uint32', 'string'],
    [groupProperties.groupIndex, groupProperties.generationTimestamp, accountId]
  );
};

// export type SHA256 = (inputs: any[]) => BigNumber;

// export const sha256 = (inputs: any[]): BigNumber => {
//   return BigNumber.from(
//     ethers.utils.sha256(ethers.utils.solidityPack(['string', 'uint256'], [inputs[0], inputs[1]]))
//   );
// };

// export const keccak256 = (inputs: any[]): BigNumber => {
//   return BigNumber.from(
//     ethers.utils.keccak256(ethers.utils.solidityPack(['string', 'uint256'], [inputs[0], inputs[1]]))
//   );
// };

export const generateLeavesFromData = (data: MerkleTreeData) => {
  return Object.entries(data).map(([key, value]) =>
    keccak256(ethers.utils.solidityPack(['string', 'uint256'], [key, value]))
  );
};

export const encodeGithubMerkleProofData = (
  path: any[],
  accountId: string,
  identityAttestationId: BigNumber
) => {
  return ethers.utils.defaultAbiCoder.encode(
    ['tuple(bytes32[],string,uint256)'],
    [[path, accountId, identityAttestationId.toString()]]
  );
};
