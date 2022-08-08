import { BigNumber, ethers } from 'ethers';
import { v4 as uuidv4 } from 'uuid';

/*************************************************/
/**************    MOCK ACCOUNTS     *************/
/*************************************************/

export type GithubAccountData = {
  identifier: string;
  account: string;
};

export const generateGithubAccounts = async (signers): Promise<GithubAccountData[]> => {
  const accounts: GithubAccountData[] = [];
  for (const signer of signers) {
    const address = BigNumber.from(signer.address).toHexString();
    accounts.push({
      identifier: uuidv4(),
      account: address,
    });
  }
  return accounts;
};

/*************************************************/
/****************    DATA SOURCE     *************/
/*************************************************/

export type GithubList = { [address: string]: number };

export const generateGithubLists = (Accounts: GithubAccountData[]): GithubList[] => {
  const List1 = {};
  const List2 = {};
  Accounts.forEach((account, index) => {
    Object.assign(List1, { [account.identifier]: index + 1 });
    Object.assign(List2, { [account.identifier]: index + 1 });
  });
  return [List1, List2];
};

export type GithubGroup = {
  data: GithubList;
  properties: GithubGroupProperties;
  id: string;
};

export type GithubGroupProperties = {
  groupIndex: number;
  generationTimestamp: number;
};

export type GithubAttesterGroups = {
  groups: GithubGroup[];
};

export const generateGithubAttesterGroups = async (
  allList: GithubList[]
): Promise<GithubAttesterGroups> => {
  /*********************** GENERATE GROUPS *********************/

  const groups: GithubGroup[] = [];
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

  return {
    groups,
  };
};

export const encodeGithubGroupProperties = (groupProperties: GithubGroupProperties): string => {
  return ethers.utils.defaultAbiCoder.encode(
    ['uint128', 'uint32'],
    [groupProperties.groupIndex, groupProperties.generationTimestamp]
  );
};
