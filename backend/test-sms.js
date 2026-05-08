import axios from 'axios';

const API_URL = 'https://vas.sevenomedia.com/domestic/sendsms/jsonapi.php';
const API_KEY = 'DxqalPWe';

const test = async (label, payload) => {
  console.log(`\n=== ${label} ===`);
  console.log('Payload:', JSON.stringify(payload, null, 2));

  // Verify no hidden chars in string values
  for (const item of payload.data) {
    for (const [key, val] of Object.entries(item)) {
      const trimmed = String(val).trim();
      if (trimmed !== String(val)) {
        console.log(`⚠️  Hidden whitespace in "${key}": [${val}] vs trimmed [${trimmed}]`);
      }
      const codes = [...String(val)].map(c => c.charCodeAt(0));
      if (codes.some(c => c < 32 && c !== 10)) {
        console.log(`⚠️  Control char in "${key}":`, codes);
      }
    }
  }

  try {
    const res = await axios.post(API_URL, payload, {
      headers: { 'Content-Type': 'application/json', 'apiKey': API_KEY }
    });
    console.log('✅ Response:', JSON.stringify(res.data));
  } catch (e) {
    console.log('❌ Error:', JSON.stringify(e.response?.data || e.message));
  }
};

// Test 1: Exact format — destination WITH 91 prefix, type TEXT
await test('WITH 91 prefix + TEXT', {
  data: [{
    destination: '917972531164',
    source: 'NamJin',
    type: 'TEXT',
    entityId: '1201159239283403256',
    tempId: '1707177796052193562',
    content: 'Your OTP for PARAM is 123456. Do Not Share it.'
  }]
});

// Test 2: destination WITHOUT 91 prefix
await test('WITHOUT 91 prefix + TEXT', {
  data: [{
    destination: '7972531164',
    source: 'NamJin',
    type: 'TEXT',
    entityId: '1201159239283403256',
    tempId: '1707177796052193562',
    content: 'Your OTP for PARAM is 123456. Do Not Share it.'
  }]
});

// Test 3: type lowercase "text"
await test('WITH 91 prefix + text (lowercase)', {
  data: [{
    destination: '917972531164',
    source: 'NamJin',
    type: 'text',
    entityId: '1201159239283403256',
    tempId: '1707177796052193562',
    content: 'Your OTP for PARAM is 123456. Do Not Share it.'
  }]
});

// Test 4: WITHOUT 91 prefix + lowercase type
await test('WITHOUT 91 prefix + text (lowercase)', {
  data: [{
    destination: '7972531164',
    source: 'NamJin',
    type: 'text',
    entityId: '1201159239283403256',
    tempId: '1707177796052193562',
    content: 'Your OTP for PARAM is 123456. Do Not Share it.'
  }]
});

console.log('\n=== ALL TESTS COMPLETE ===');
