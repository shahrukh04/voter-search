function credentials() {
  const username = process.env.TWILIO_API_KEY_SID || process.env.TWILIO_ACCOUNT_SID;
  const secret = process.env.TWILIO_API_KEY_SID ? process.env.TWILIO_API_KEY_SECRET : process.env.TWILIO_AUTH_TOKEN;
  const service = process.env.TWILIO_VERIFY_SERVICE_SID;
  if (!username || !secret || !/^VA[0-9a-f]{32}$/i.test(service || '')) {
    const error = new Error('otp_unavailable');
    error.status = 503;
    throw error;
  }
  return { username, secret, service };
}

async function verifyRequest(resource, fields) {
  const { username, secret, service } = credentials();
  const response = await fetch('https://verify.twilio.com/v2/Services/' + service + '/' + resource, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(username + ':' + secret).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(fields),
    signal: AbortSignal.timeout(15000),
  });
  const result = await response.json();
  if (!response.ok) {
    const error = new Error(response.status === 404 ? 'invalid_otp' : 'otp_provider_error');
    error.status = response.status === 404 ? 400 : 503;
    throw error;
  }
  return result;
}

module.exports = { credentials, verifyRequest };
