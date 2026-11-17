import assert from 'node:assert';
import motorsportHandler from '../netlify/functions/motorsport-feed.mjs';
import pairHandler from '../netlify/functions/pair-loq.mjs';
import loqCommandHandler from '../netlify/functions/loq-command.mjs';

async function testMotorsportFeed() {
  console.log('Testing motorsport-feed function...');
  const req = new Request('https://nervesite.netlify.app/.netlify/functions/motorsport-feed?series=wec');
  const res = await motorsportHandler(req);
  assert.strictEqual(res.status, 200, 'Expected 200 status for WEC feed');
  const text = await res.text();
  assert.ok(text.includes('<rss') || text.includes('<?xml'), 'Expected RSS XML response');
  console.log('  motorsport-feed OK');
}

async function testPairLoq() {
  console.log('Testing pair-loq function without relay...');
  const req = new Request('https://nervesite.netlify.app/.netlify/functions/pair-loq', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pairing_code: 'testcode12345678' }),
  });
  const res = await pairHandler(req);
  assert.strictEqual(res.status, 503, 'Expected 503 status when relay unconfigured');
  const data = await res.json();
  assert.ok(data.detail, 'Expected error detail in response');
  console.log('  pair-loq OK');
}

async function testLoqCommand() {
  console.log('Testing loq-command function without relay...');
  const req = new Request('https://nervesite.netlify.app/.netlify/functions/loq-command', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ access_token: 'dummy', path: '/metrics' }),
  });
  const res = await loqCommandHandler(req);
  assert.strictEqual(res.status, 503, 'Expected 503 status when relay unconfigured');
  const data = await res.json();
  assert.ok(data.detail, 'Expected error detail in response');
  console.log('  loq-command OK');
}

async function runTests() {
  try {
    await testMotorsportFeed();
    await testPairLoq();
    await testLoqCommand();
    console.log('All Netlify function tests passed!');
  } catch (err) {
    console.error('Test failed:', err);
    process.exit(1);
  }
}

runTests();
