import { OpenClawClient } from './openclaw.js';

// Standalone test for OpenClaw connection
async function testOpenClawConnection() {
  console.log('🧪 Testing OpenClaw connection...\n');
  
  const client = new OpenClawClient();
  
  try {
    await client.connect();
    console.log('✅ Connected to OpenClaw\n');
    
    const testQuestion = 'Ciao, funzioni?';
    console.log(`📝 Sending: "${testQuestion}"\n`);
    
    const response = await client.ask(testQuestion);
    console.log(`✅ Response received:\n${response}\n`);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    client.disconnect();
    console.log('🔌 Disconnected');
  }
  
  process.exit(0);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testOpenClawConnection();
}

export { testOpenClawConnection };
