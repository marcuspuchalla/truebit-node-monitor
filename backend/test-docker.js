import DockerClient from './src/docker/client.js';
import LogParser from './src/parsers/log-parser.js';

async function test() {
  console.log('🧪 Testing Docker Connection...\n');

  const client = new DockerClient('runner-node');
  const parser = new LogParser();

  try {
    // Test 1: Ping Docker daemon
    console.log('1️⃣  Testing Docker daemon connection...');
    const pingOk = await client.ping();
    if (!pingOk) {
      throw new Error('Docker daemon not accessible');
    }
    console.log('✅ Docker daemon is accessible\n');

    // Test 2: Initialize client
    console.log('2️⃣  Connecting to runner-node container...');
    await client.initialize();
    console.log('✅ Connected to container\n');

    // Test 3: Get container info
    console.log('3️⃣  Fetching container information...');
    const info = await client.getContainerInfo();
    console.log('✅ Container Info:');
    console.log(`   ID: ${info.id}`);
    console.log(`   Name: ${info.name}`);
    console.log(`   State: ${info.state}`);
    console.log(`   Running: ${info.running}`);
    console.log(`   Started: ${info.startedAt}\n`);

    // Test 4: Get container stats
    console.log('4️⃣  Fetching container stats...');
    const stats = await client.getContainerStats();
    if (stats) {
      console.log('✅ Container Stats:');
      console.log(`   CPU: ${stats.cpu}%`);
      console.log(`   Memory: ${stats.memory.usage}MB / ${stats.memory.limit}MB (${stats.memory.percent}%)\n`);
    } else {
      console.log('⚠️  Could not fetch stats\n');
    }

    // Test 5: Get historical logs
    console.log('5️⃣  Fetching last 50 log lines...');
    const logs = await client.getHistoricalLogs(50);
    const lines = logs.split('\n').filter(l => l.trim());
    console.log(`✅ Retrieved ${lines.length} log lines\n`);

    // Test 6: Parse logs
    console.log('6️⃣  Parsing log entries...');
    let taskCount = 0;
    let invoiceCount = 0;
    let errorCount = 0;

    lines.forEach(line => {
      const parsed = parser.parseLine(line);
      if (parsed) {
        if (parsed.type === 'task_received') taskCount++;
        if (parsed.type === 'invoice') invoiceCount++;
        if (parsed.level === 'error') errorCount++;
      }
    });

    console.log('✅ Log parsing results:');
    console.log(`   Tasks found: ${taskCount}`);
    console.log(`   Invoices found: ${invoiceCount}`);
    console.log(`   Errors found: ${errorCount}\n`);

    // Test 7: Show sample parsed log
    console.log('7️⃣  Sample parsed log entry:');
    for (const line of lines) {
      const parsed = parser.parseLine(line);
      if (parsed && parsed.type !== 'raw') {
        console.log('✅ Sample:');
        console.log(JSON.stringify(parsed, null, 2));
        break;
      }
    }

    console.log('\n✅ All tests passed! The monitor can successfully connect to your TrueBit node.\n');
    console.log('Next steps:');
    console.log('  1. Run: cd /home/cb0/truebit/truebit-monitor');
    console.log('  2. Run: docker compose -f docker-compose.monitor.yml up -d');
    console.log('  3. Open: http://localhost:8080\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('\nTroubleshooting:');
    console.error('  • Ensure Docker is running: docker ps');
    console.error('  • Check container name: docker ps | grep runner');
    console.error('  • Verify permissions: ls -la /var/run/docker.sock');
    console.error('  • Try: sudo chmod 666 /var/run/docker.sock (or add user to docker group)\n');
    process.exit(1);
  }

  process.exit(0);
}

test();
