import {iMultiPoolsAssets, IReserveParams, tEthereumAddress} from './types';
import {LendingPoolConfigurator} from '../types/LendingPoolConfigurator';
import {AaveProtocolTestHelpers} from '../types/AaveProtocolTestHelpers';
import {
  deployATokensAndRatesHelper,
  deployStableAndVariableTokensHelper,
} from './contracts-deployments';
import {chunk, waitForTx} from './misc-utils';
import {getATokensAndRatesHelper, getLendingPoolAddressesProvider} from './contracts-getters';

export const initReservesByHelper = async (
  lendingPoolProxy: tEthereumAddress,
  addressesProvider: tEthereumAddress,
  lendingPoolConfigurator: tEthereumAddress,
  reservesParams: iMultiPoolsAssets<IReserveParams>,
  tokenAddresses: {[symbol: string]: tEthereumAddress},
  helpers: AaveProtocolTestHelpers,
  admin: tEthereumAddress,
  incentivesController: tEthereumAddress,
  verify?: boolean
) => {
  const stableAndVariableDeployer = await deployStableAndVariableTokensHelper(
    [lendingPoolProxy, addressesProvider],
    verify
  );
  const atokenAndRatesDeployer = await deployATokensAndRatesHelper([
    lendingPoolProxy,
    addressesProvider,
    lendingPoolConfigurator,
  ]);
  const addressProvider = await getLendingPoolAddressesProvider(addressesProvider);

  // Set aTokenAndRatesDeployer as temporal admin
  await waitForTx(await addressProvider.setAaveAdmin(atokenAndRatesDeployer.address));

  // CHUNK CONFIGURATION
  const tokensChunks = 3;
  const initChunks = 6;

  // Deploy tokens and rates in chunks
  const reservesChunks = chunk(
    Object.entries(reservesParams) as [string, IReserveParams][],
    tokensChunks
  );
  // Initialize variables for future reserves initialization
  let deployedStableTokens: string[] = [];
  let deployedVariableTokens: string[] = [];
  let deployedATokens: string[] = [];
  let deployedRates: string[] = [];
  let reserveTokens: string[] = [];
  let reserveInitDecimals: string[] = [];

  console.log(
    `- Token deployments in ${reservesChunks.length * 2} txs instead of ${
      Object.entries(reservesParams).length * 4
    } txs`
  );
  for (let reservesChunk of reservesChunks) {
    // Prepare data
    const tokens: string[] = [];
    const symbols: string[] = [];
    const strategyRates: string[][] = [];
    const reservesDecimals: string[] = [];

    for (let [assetSymbol, {reserveDecimals}] of reservesChunk) {
      const assetAddressIndex = Object.keys(tokenAddresses).findIndex(
        (value) => value === assetSymbol
      );
      const [, tokenAddress] = (Object.entries(tokenAddresses) as [string, string][])[
        assetAddressIndex
      ];

      const reserveParamIndex = Object.keys(reservesParams).findIndex(
        (value) => value === assetSymbol
      );
      const [
        ,
        {
          baseVariableBorrowRate,
          variableRateSlope1,
          variableRateSlope2,
          stableRateSlope1,
          stableRateSlope2,
        },
      ] = (Object.entries(reservesParams) as [string, IReserveParams][])[reserveParamIndex];
      // Add to lists
      tokens.push(tokenAddress);
      symbols.push(assetSymbol === 'WETH' ? 'ETH' : assetSymbol);
      strategyRates.push([
        baseVariableBorrowRate,
        variableRateSlope1,
        variableRateSlope2,
        stableRateSlope1,
        stableRateSlope2,
      ]);
      reservesDecimals.push(reserveDecimals);
    }

    // Deploy stable and variable deployers
    const tx1 = await waitForTx(
      await stableAndVariableDeployer.initDeployment(tokens, symbols, incentivesController)
    );

    // Deploy atokens and rate strategies
    const tx2 = await waitForTx(
      await atokenAndRatesDeployer.initDeployment(
        tokens,
        symbols,
        strategyRates,
        incentivesController
      )
    );
    console.log(`  - Deployed aToken, DebtTokens and Strategy for: ${symbols.join(', ')} `);
    const stableTokens: string[] = tx1.events?.map((e) => e.args?.stableToken) || [];
    const variableTokens: string[] = tx1.events?.map((e) => e.args?.variableToken) || [];
    const aTokens: string[] = tx2.events?.map((e) => e.args?.aToken) || [];
    const strategies: string[] = tx2.events?.map((e) => e.args?.strategy) || [];

    deployedStableTokens = [...deployedStableTokens, ...stableTokens];
    deployedVariableTokens = [...deployedVariableTokens, ...variableTokens];
    deployedATokens = [...deployedATokens, ...aTokens];
    deployedRates = [...deployedRates, ...strategies];
    reserveInitDecimals = [...reserveInitDecimals, ...reservesDecimals];
    reserveTokens = [...reserveTokens, ...tokens];
  }

  // Deploy init reserves per chunks
  const chunkedStableTokens = chunk(deployedStableTokens, initChunks);
  const chunkedVariableTokens = chunk(deployedVariableTokens, initChunks);
  const chunkedAtokens = chunk(deployedATokens, initChunks);
  const chunkedRates = chunk(deployedRates, initChunks);
  const chunkedDecimals = chunk(reserveInitDecimals, initChunks);
  const chunkedSymbols = chunk(Object.keys(tokenAddresses), initChunks);

  console.log(`- Reserves initialization in ${chunkedStableTokens.length} txs`);
  for (let chunkIndex = 0; chunkIndex < chunkedDecimals.length; chunkIndex++) {
    const tx3 = await waitForTx(
      await atokenAndRatesDeployer.initReserve(
        chunkedStableTokens[chunkIndex],
        chunkedVariableTokens[chunkIndex],
        chunkedAtokens[chunkIndex],
        chunkedRates[chunkIndex],
        chunkedDecimals[chunkIndex]
      )
    );
    console.log(`  - Reserve ready for: ${chunkedSymbols[chunkIndex].join(', ')}`);
  }

  // Set deployer back as admin
  await waitForTx(await addressProvider.setAaveAdmin(admin));
};

export const getPairsTokenAggregator = (
  allAssetsAddresses: {
    [tokenSymbol: string]: tEthereumAddress;
  },
  aggregatorsAddresses: {[tokenSymbol: string]: tEthereumAddress}
): [string[], string[]] => {
  const {ETH, USD, WETH, ...assetsAddressesWithoutEth} = allAssetsAddresses;

  const pairs = Object.entries(assetsAddressesWithoutEth).map(([tokenSymbol, tokenAddress]) => {
    if (tokenSymbol !== 'WETH' && tokenSymbol !== 'ETH') {
      const aggregatorAddressIndex = Object.keys(aggregatorsAddresses).findIndex(
        (value) => value === tokenSymbol
      );
      const [, aggregatorAddress] = (Object.entries(aggregatorsAddresses) as [
        string,
        tEthereumAddress
      ][])[aggregatorAddressIndex];
      return [tokenAddress, aggregatorAddress];
    }
  }) as [string, string][];

  const mappedPairs = pairs.map(([asset]) => asset);
  const mappedAggregators = pairs.map(([, source]) => source);

  return [mappedPairs, mappedAggregators];
};

export const enableReservesToBorrowByHelper = async (
  reservesParams: iMultiPoolsAssets<IReserveParams>,
  tokenAddresses: {[symbol: string]: tEthereumAddress},
  helpers: AaveProtocolTestHelpers,
  admin: tEthereumAddress
) => {
  const addressProvider = await getLendingPoolAddressesProvider();
  const atokenAndRatesDeployer = await getATokensAndRatesHelper();
  const tokens: string[] = [];
  const symbols: string[] = [];
  const stableEnabled: boolean[] = [];

  // Prepare data
  for (const [assetSymbol, {borrowingEnabled, stableBorrowRateEnabled}] of Object.entries(
    reservesParams
  ) as [string, IReserveParams][]) {
    if (!borrowingEnabled) continue;
    const assetAddressIndex = Object.keys(tokenAddresses).findIndex(
      (value) => value === assetSymbol
    );
    const [, tokenAddress] = (Object.entries(tokenAddresses) as [string, string][])[
      assetAddressIndex
    ];
    const {borrowingEnabled: borrowingAlreadyEnabled} = await helpers.getReserveConfigurationData(
      tokenAddress
    );

    if (borrowingAlreadyEnabled) {
      console.log(`Reserve ${assetSymbol} is already enabled for borrowing, skipping`);
      continue;
    }
    tokens.push(tokenAddress);
    stableEnabled.push(stableBorrowRateEnabled);
    symbols.push(assetSymbol);
  }
  if (tokens.length) {
    // Set aTokenAndRatesDeployer as temporal admin
    await waitForTx(await addressProvider.setAaveAdmin(atokenAndRatesDeployer.address));

    // Deploy init per chunks
    const stableChunks = 20;
    const chunkedTokens = chunk(tokens, stableChunks);
    const chunkedSymbols = chunk(symbols, stableChunks);
    const chunkedStableEnabled = chunk(stableEnabled, stableChunks);

    console.log(`- Borrow stable initialization in ${chunkedTokens.length} txs`);
    for (let chunkIndex = 0; chunkIndex < chunkedTokens.length; chunkIndex++) {
      try {
        await waitForTx(
          await atokenAndRatesDeployer.enableBorrowingOnReserves(
            chunkedTokens[chunkIndex],
            chunkedStableEnabled[chunkIndex],
            {gasLimit: 12000000}
          )
        );
      } catch (error) {
        console.error(error);
        throw error;
      }

      console.log(`  - Init for: ${chunkedSymbols[chunkIndex].join(', ')}`);
    }
    // Set deployer back as admin
    await waitForTx(await addressProvider.setAaveAdmin(admin));
  }
};

export const enableReservesAsCollateralByHelper = async (
  reservesParams: iMultiPoolsAssets<IReserveParams>,
  tokenAddresses: {[symbol: string]: tEthereumAddress},
  helpers: AaveProtocolTestHelpers,
  admin: tEthereumAddress
) => {
  const addressProvider = await getLendingPoolAddressesProvider();
  const atokenAndRatesDeployer = await getATokensAndRatesHelper();
  const tokens: string[] = [];
  const symbols: string[] = [];
  const baseLTVA: string[] = [];
  const liquidationThresholds: string[] = [];
  const liquidationBonuses: string[] = [];

  for (const [
    assetSymbol,
    {baseLTVAsCollateral, liquidationBonus, liquidationThreshold},
  ] of Object.entries(reservesParams) as [string, IReserveParams][]) {
    if (baseLTVAsCollateral === '-1') continue;

    const assetAddressIndex = Object.keys(tokenAddresses).findIndex(
      (value) => value === assetSymbol
    );
    const [, tokenAddress] = (Object.entries(tokenAddresses) as [string, string][])[
      assetAddressIndex
    ];
    const {usageAsCollateralEnabled: alreadyEnabled} = await helpers.getReserveConfigurationData(
      tokenAddress
    );

    if (alreadyEnabled) {
      console.log(`- Reserve ${assetSymbol} is already enabled as collateral, skipping`);
      continue;
    }
    // Push data
    tokens.push(tokenAddress);
    symbols.push(assetSymbol);
    baseLTVA.push(baseLTVAsCollateral);
    liquidationThresholds.push(liquidationThreshold);
    liquidationBonuses.push(liquidationBonus);
  }
  if (tokens.length) {
    // Set aTokenAndRatesDeployer as temporal admin
    await waitForTx(await addressProvider.setAaveAdmin(atokenAndRatesDeployer.address));

    // Deploy init per chunks
    const enableChunks = 20;
    const chunkedTokens = chunk(tokens, enableChunks);
    const chunkedSymbols = chunk(symbols, enableChunks);
    const chunkedBase = chunk(baseLTVA, enableChunks);
    const chunkedliquidationThresholds = chunk(liquidationThresholds, enableChunks);
    const chunkedliquidationBonuses = chunk(liquidationBonuses, enableChunks);

    console.log(`- Enable reserve as collateral in ${chunkedTokens.length} txs`);
    for (let chunkIndex = 0; chunkIndex < chunkedTokens.length; chunkIndex++) {
      await waitForTx(
        await atokenAndRatesDeployer.enableReservesAsCollateral(
          chunkedTokens[chunkIndex],
          chunkedBase[chunkIndex],
          chunkedliquidationThresholds[chunkIndex],
          chunkedliquidationBonuses[chunkIndex],
          {gasLimit: 12000000}
        )
      );
      console.log(`  - Init for: ${chunkedSymbols[chunkIndex].join(', ')}`);
    }
    // Set deployer back as admin
    await waitForTx(await addressProvider.setAaveAdmin(admin));
  }
};
