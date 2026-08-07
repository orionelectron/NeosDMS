// Live smoke for DMS field-sales Phase A.
const BASE = 'http://localhost:3000/api/v1';
const OWNER = { email: 'field-smoke@test.com', password: 'Password123!' };

function j(path, res, body) {
  let b;
  try { b = JSON.parse(body); } catch { b = body; }
  const ok = res.ok;
  const summary = b?.data?.id || (b?.data?.success != null ? b.data.success : '') || '';
  console.log(`${ok ? 'OK ' : 'ERR'} ${res.status} ${path} -> ${summary}`);
  return b?.data ?? b;
}

async function req(method, path, token, body) {
  const r = await fetch(BASE + path, {
    method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const txt = await r.text();
  return { ok: r.ok, status: r.status, data: j(path, r, txt) };
}

async function login(email, password) {
  const r = await fetch(BASE + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const b = JSON.parse(await r.text());
  if (!b?.data?.tokens?.accessToken) throw new Error(`login failed ${r.status} ${JSON.stringify(b)}`);
  return { token: b.data.tokens.accessToken, org: b.data.user.organizationId, branch: b.data.user.branchId, user: b.data.user };
}

async function main() {
  const owner = await login(OWNER.email, OWNER.password);
  console.log('owner org', owner.org, 'branch', owner.branch);

  const rolesRes = await req('GET', '/roles', owner.token);
  const roles = rolesRes.data;
  const salesRole = roles.find((r) => r.code === 'salesman');
  console.log('salesman roleId:', salesRole?.id);

  // reuse fixed seed users (plan caps users at 5; smoke must not create more)
  const smLogin = await login('salesman-smoke@test.com', 'Password123!');
  const drvLogin = await login('driver-smoke@test.com', 'Password123!');

  const runId = Date.now().toString(36);

  // salesman: outlet + route + link
  const out = await req('POST', '/outlets', smLogin.token, {
    name: `Kathmandu Surya ${runId}`, ownerName: 'Ramesh', phone: '014440001',
    district: 'Kathmandu', latitude: 27.7172, longitude: 85.3136, channel: 'GENERAL_TRADE',
  });
  const outletId = out.data.id;

  const rt = await req('POST', '/routes', smLogin.token, {
    name: `North Kathmandu ${runId}`, code: `R-NORTH-${runId}`, district: 'Kathmandu',
  });
  const routeId = rt.data.id;

  await req('POST', `/outlets/${outletId}/routes/${routeId}`, smLogin.token);
  await req('GET', `/routes/${routeId}/outlets`, smLogin.token);

  // admin assigns salesman to route
  await req('POST', '/route-assignments', owner.token, { userId: smLogin.user.id, routeId, weekdays: [1, 3, 5] });

  // salesman creates visit + check-in/on-out + check-out
  const vis = await req('POST', '/visits', smLogin.token, { routeId, outletId });
  const visitId = vis.data.id;
  const ci1 = await req('POST', `/visits/${visitId}/check-in`, smLogin.token, { latitude: 27.7172, longitude: 85.3136, remarks: 'on spot' });
  console.log('  on-spot  is_off_route:', ci1.data.isOffRoute, 'distance:', ci1.data.distanceFromOutletMeters);

  await req('POST', `/visits/${visitId}/check-out`, smLogin.token, { latitude: 27.7172, longitude: 85.3136 });
  const got = (await req('GET', `/visits/${visitId}`, smLogin.token)).data;
  console.log('  final status:', got.status);

  // far check-in -> off-route
  const vis2 = (await req('POST', '/visits', smLogin.token, { routeId, outletId })).data;
  const ci2 = await req('POST', `/visits/${vis2.id}/check-in`, smLogin.token, { latitude: 27.7192, longitude: 85.3136 });
  console.log('  far      is_off_route:', ci2.data.isOffRoute, 'distance:', ci2.data.distanceFromOutletMeters);

  // salesman-scoped reads
  await req('GET', '/outlets/mine', smLogin.token);
  await req('GET', '/routes/mine', smLogin.token);

  // RBAC negative: driver cannot read outlets/routes
  await req('GET', '/outlets', drvLogin.token);
  await req('GET', '/routes', drvLogin.token);

  // duplicate outlet name
  await req('POST', '/outlets', smLogin.token, { name: `Kathmandu Surya ${runId}` });

  // negative: outlet not on route (salesman IS assigned, outlet not linked -> 400)
  const rt2 = await req('POST', '/routes', smLogin.token, { name: `Far Route ${runId}`, code: `R-FAR-${runId}` });
  await req('POST', '/route-assignments', owner.token, { userId: smLogin.user.id, routeId: rt2.data.id, weekdays: [1, 3, 5] });
  await req('POST', '/visits', smLogin.token, { routeId: rt2.data.id, outletId });

  console.log('SMOKE DONE');
}
main().catch((e) => { console.error('SMOKE FAIL', e); process.exit(1); });
