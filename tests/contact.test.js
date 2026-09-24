const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../api/public/contact.js'), 'utf8');

function validApplication() {
  return {
    name: 'Test Applicant',
    email: 'applicant@example.com',
    phone: '+32 400 00 00 00',
    consent: true,
    language: 'en',
    website: '',
    answers: {
      goal: 'Build strength or muscle',
      goalDetail: 'I want to build strength and train consistently.',
      experience: 'Some experience, inconsistent',
      frequency: '1–2 times per week',
      trainingHelp: '',
      location: 'Auderghem',
      availability: 'Weekday mornings',
    },
  };
}

async function submit(body) {
  const sent = [];
  const context = {
    module: { exports: {} },
    Buffer,
    URL,
    console,
    process: { env: { GMAIL_USER: 'test@example.com', GMAIL_APP_PASSWORD: 'test-only' } },
    // No real mail, network, or storage module is available to these tests.
    require(name) {
      assert.equal(name, 'nodemailer', `Unexpected dependency: ${name}`);
      return { createTransport: () => ({ sendMail: async (message) => { sent.push(message); } }) };
    },
  };
  vm.runInNewContext(source, context, { filename: 'contact.js' });
  const res = {
    status(code) { this.statusCode = code; return this; },
    json(data) { this.body = data; return this; },
    setHeader() {},
  };
  await context.module.exports({
    method: 'POST',
    headers: { host: 'devresse.fit', origin: 'https://devresse.fit' },
    socket: { remoteAddress: '127.0.0.1' },
    body,
  }, res);
  return { res, sent };
}

for (const field of ['goal', 'goalDetail', 'experience', 'frequency', 'location', 'availability']) {
  for (const value of [undefined, '', ' \t\r\n\u00a0 ', '\u0000', {}, ['text']]) {
    test(`rejects ${field}=${JSON.stringify(value)} before delivery`, async () => {
      const body = validApplication();
      body.answers[field] = value;
      const { res, sent } = await submit(body);
      assert.equal(res.statusCode, 400);
      assert.equal(sent.length, 0);
    });
  }
}

for (const field of ['name', 'email', 'phone']) {
  test(`rejects a whitespace-only ${field} before delivery`, async () => {
    const body = validApplication();
    body[field] = ' \t\n ';
    const { res, sent } = await submit(body);
    assert.equal(res.statusCode, 400);
    assert.equal(sent.length, 0);
  });
}

test('rejects a legacy label-only message without structured answers', async () => {
  const body = validApplication();
  delete body.answers;
  body.message = 'Goal: \n\nMeaningful progress: \n\nExperience: \n\nCurrent frequency: ';
  const { res, sent } = await submit(body);
  assert.equal(res.statusCode, 400);
  assert.equal(sent.length, 0);
});

test('rejects missing consent before delivery', async () => {
  const body = validApplication();
  body.consent = false;
  const { res, sent } = await submit(body);
  assert.equal(res.statusCode, 400);
  assert.equal(sent.length, 0);
});

for (const value of ['https://spam.example', { url: 'spam' }]) {
  test(`silently discards a filled honeypot ${JSON.stringify(value)}`, async () => {
    const body = validApplication();
    body.website = value;
    const { res, sent } = await submit(body);
    assert.equal(res.statusCode, 200);
    assert.equal(sent.length, 0);
  });
}

for (const [language, label] of [['en', 'Training help wanted'], ['fr', 'Aide souhaitée'], ['nl', 'Gewenste hulp']]) {
  test(`accepts valid ${language} answers with optional help blank and no budget/commitment`, async () => {
    const body = validApplication();
    body.language = language;
    body.answers.goalDetail = '  Strength  ';
    body.message = 'Do not include untrusted preformatted text';
    const { res, sent } = await submit(body);
    assert.equal(res.statusCode, 200);
    assert.equal(sent.length, 1);
    assert.ok(sent[0].html.includes(label));
    assert.ok(sent[0].html.includes(': Strength<br>'));
    assert.ok(!sent[0].html.includes('Do not include'));
    assert.ok(!sent[0].html.includes('Budget'));
    assert.equal(sent[0].replyTo, body.email);
  });
}

test('escapes written answers in the notification', async () => {
  const body = validApplication();
  body.answers.trainingHelp = '<script>alert("example")</script>';
  const { res, sent } = await submit(body);
  assert.equal(res.statusCode, 200);
  assert.ok(sent[0].html.includes('&lt;script&gt;'));
  assert.ok(!sent[0].html.includes('<script>'));
});
