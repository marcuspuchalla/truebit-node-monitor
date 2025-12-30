/**
 * Quick test for TokenService (standalone, no Docker required)
 * Usage: npx tsx src/test-token-service.ts
 */

import TokenService from './services/tokenService.js';

async function main() {
  console.log('🧪 Testing TokenService...\n');

  const service = new TokenService();

  // Test CoinGecko metrics
  console.log('📊 Fetching CoinGecko metrics...');
  const geckoMetrics = await service.fetchCoinGeckoMetrics();
  console.log('   Price:', geckoMetrics.price ? `$${geckoMetrics.price.toFixed(4)}` : 'N/A');
  console.log('   24h Change:', geckoMetrics.priceChange24h ? `${geckoMetrics.priceChange24h.toFixed(2)}%` : 'N/A');
  console.log('   Market Cap:', geckoMetrics.marketCap ? `$${geckoMetrics.marketCap.toLocaleString()}` : 'N/A');
  console.log('   Total Supply:', geckoMetrics.totalSupply || 'N/A');
  console.log('   Circulating Supply:', geckoMetrics.circulatingSupply || 'N/A');
  console.log();

  // Test ALL burn transfers from genesis
  console.log('🔥 Fetching ALL burn transfers from Etherscan...');
  console.log('   (This takes ~30 seconds due to API rate limiting)');

  try {
    const burns = await service.fetchBurnTransfers(0); // All blocks
    console.log(`   Found ${burns.length} burn transfers total`);

    if (burns.length > 0) {
      // Calculate totals
      let total = 0n;
      for (const b of burns) {
        total += BigInt(b.amount);
      }
      const totalTRU = Number(total) / 1e18;
      console.log(`   Total TRU burned: ${totalTRU.toLocaleString()}`);

      console.log('\n   First 5 burns:');
      for (const burn of burns.slice(0, 5)) {
        const date = new Date(burn.timestamp).toISOString().split('T')[0];
        console.log(`   - ${date}: ${burn.amountFormatted.toLocaleString()} TRU from ${burn.from.slice(0, 10)}...`);
      }

      console.log('\n   Last 5 burns:');
      for (const burn of burns.slice(-5)) {
        const date = new Date(burn.timestamp).toISOString().split('T')[0];
        console.log(`   - ${date}: ${burn.amountFormatted.toLocaleString()} TRU from ${burn.from.slice(0, 10)}...`);
      }

      // Test chart data
      console.log('\n📈 Testing chart data generation...');
      // Load burns into cache first
      service.loadFromCache(burns, burns[burns.length - 1]?.blockNumber || 0);
      const chartData = service.getChartData();
      console.log(`   Generated ${chartData.length} chart data points`);
      if (chartData.length > 0) {
        console.log(`   First date: ${chartData[0].date}`);
        console.log(`   Last date: ${chartData[chartData.length - 1].date}`);
        console.log(`   Final cumulative: ${chartData[chartData.length - 1].cumulativeBurned.toLocaleString()} TRU`);
      }

      // Test leaderboard
      console.log('\n🏆 Testing leaderboard...');
      const leaderboard = service.getLeaderboard(5);
      console.log(`   Top ${leaderboard.length} burners:`);
      for (const entry of leaderboard) {
        const amt = Number(BigInt(entry.totalBurned)) / 1e18;
        console.log(`   - ${entry.address.slice(0, 10)}...: ${amt.toLocaleString()} TRU (${entry.burnCount} burns)`);
      }
    }
  } catch (error) {
    console.log('   Error:', (error as Error).message);
    console.log('   (API key may be required for full burn history)');
  }

  console.log('\n✅ Test complete!');
}

main().catch(console.error);
