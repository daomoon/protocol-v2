/* Generated by ts-generator ver. 0.0.8 */
/* tslint:disable */

import { Contract, ContractFactory, Signer } from "ethers";
import { Provider } from "ethers/providers";
import { UnsignedTransaction } from "ethers/utils/transaction";

import { TransactionOverrides } from ".";
import { UintStorage } from "./UintStorage";

export class UintStorageFactory extends ContractFactory {
  constructor(signer?: Signer) {
    super(_abi, _bytecode, signer);
  }

  deploy(overrides?: TransactionOverrides): Promise<UintStorage> {
    return super.deploy(overrides) as Promise<UintStorage>;
  }
  getDeployTransaction(overrides?: TransactionOverrides): UnsignedTransaction {
    return super.getDeployTransaction(overrides);
  }
  attach(address: string): UintStorage {
    return super.attach(address) as UintStorage;
  }
  connect(signer: Signer): UintStorageFactory {
    return super.connect(signer) as UintStorageFactory;
  }
  static connect(
    address: string,
    signerOrProvider: Signer | Provider
  ): UintStorage {
    return new Contract(address, _abi, signerOrProvider) as UintStorage;
  }
}

const _abi = [
  {
    inputs: [
      {
        internalType: "bytes32",
        name: "_key",
        type: "bytes32"
      }
    ],
    name: "getUint",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256"
      }
    ],
    stateMutability: "view",
    type: "function"
  }
];

const _bytecode =
  "0x6080604052348015600f57600080fd5b5060a18061001e6000396000f3fe6080604052348015600f57600080fd5b506004361060285760003560e01c8063bd02d0f514602d575b600080fd5b604760048036036020811015604157600080fd5b50356059565b60408051918252519081900360200190f35b6000908152602081905260409020549056fea2646970667358221220bd68e5c406e3798dd84a0380e5fca02432bd9828e948826d8c339558e7076aef64736f6c63430006080033";
