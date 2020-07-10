import {expect} from "chai";
import {makeSuite, TestEnv} from "./helpers/make-suite";
import {ProtocolErrors, TokenContractId, eContractid} from "../helpers/types";
import { getContractAddress } from "ethers/utils";
import { getContract } from "../helpers/contracts-helpers";
import { StableDebtToken } from "../types/StableDebtToken";

makeSuite("Stable debt token tests", (testEnv: TestEnv) => {
  
  const {INVALID_POOL_CALLER_MSG_1} = ProtocolErrors;

  it("Tries to invoke mint not being the LendingPool", async () => {
    
    const {deployer, pool, dai} = testEnv;

    const daiStableDebtTokenAddress = (await pool.getReserveTokensAddresses(dai.address)).stableDebtTokenAddress;

    const stableDebtContract = await getContract<StableDebtToken>(eContractid.StableDebtToken, daiStableDebtTokenAddress);

    await expect(stableDebtContract.mint(deployer.address, "1", "1")).to.be.revertedWith(
      INVALID_POOL_CALLER_MSG_1
    );
  });



  it("Tries to invoke burn not being the LendingPool", async () => {
    const {deployer, pool, dai} = testEnv;

    const daiStableDebtTokenAddress = (await pool.getReserveTokensAddresses(dai.address)).stableDebtTokenAddress;

    const stableDebtContract = await getContract<StableDebtToken>(eContractid.StableDebtToken, daiStableDebtTokenAddress);

    await expect(stableDebtContract.burn(deployer.address, "1")).to.be.revertedWith(
      INVALID_POOL_CALLER_MSG_1
    );
  });
});
