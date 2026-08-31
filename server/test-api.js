async function run() {
  const baseUrl = 'http://localhost:5000/api';
  console.log('Testing /health...');
  let res = await fetch('http://localhost:5000/health');
  console.log('Health:', await res.text());
  
  console.log('\nTesting /auth/register...');
  res = await fetch(`${baseUrl}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Test Patient',
      email: 'patient@test.com',
      password: 'password123',
      role: 'patient'
    })
  });
  const data = await res.json();
  console.log('Register Response:', data);
}

run();
