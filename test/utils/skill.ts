import { BigNumber, ethers } from 'ethers';
import { v4 as uuidv4 } from 'uuid';
import randomstring from 'randomstring';

/*************************************************/
/**************    MOCK ACCOUNTS     *************/
/*************************************************/

export type SkillAccountData = {
  account: string;
};

export const generateSkillAccounts = async (signers): Promise<SkillAccountData[]> => {
  const accounts: SkillAccountData[] = [];
  for (const signer of signers) {
    const address = BigNumber.from(signer.address).toHexString();
    accounts.push({
      account: address,
    });
  }
  return accounts;
};

/*************************************************/
/****************    DATA SOURCE     *************/
/*************************************************/

export type SkillList = { [address: string]: number };

export const generateSkillLists = (Accounts: SkillAccountData[]): SkillList[] => {
  const List1 = {};
  const List2 = {};
  Accounts.forEach((account, index) => {
    Object.assign(List1, { [account.account]: index + 1 });
    Object.assign(List2, { [account.account]: index + 1 });
  });
  return [List1, List2];
};

export type SkillGroup = {
  data: SkillList;
  properties: SkillGroupProperties;
  id: string;
};

export type SkillGroupProperties = {
  groupIndex: number;
  generationTimestamp: number;
  skill: string;
};

export type SkillAttesterGroups = {
  groups: SkillGroup[];
};

export const generateSkillAttesterGroups = async (
  allList: SkillList[]
): Promise<SkillAttesterGroups> => {
  /*********************** GENERATE GROUPS *********************/

  const groups: SkillGroup[] = [];
  let generationTimestamp = Math.round(Date.now() / 1000);

  for (let i = 0; i < allList.length; i++) {
    const properties = {
      groupIndex: i,
      generationTimestamp,
      skill: randomstring.generate(),
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

export const encodeSkillGroupProperties = (groupProperties: SkillGroupProperties): string => {
  return ethers.utils.defaultAbiCoder.encode(
    ['uint128', 'uint32', 'string'],
    [groupProperties.groupIndex, groupProperties.generationTimestamp, groupProperties.skill]
  );
};
