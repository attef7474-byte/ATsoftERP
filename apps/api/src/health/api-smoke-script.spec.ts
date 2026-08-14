export {};

type SmokeEndpoint = {
  name: string;
  method: string;
  path: string;
  requiresAuth: boolean;
  requiresContext: boolean;
};

type SmokeModule = {
  API_ENDPOINTS: SmokeEndpoint[];
  buildConfig: (
    environment?: Record<string, string | undefined>,
    argumentsList?: string[],
  ) => any;
  buildPlan: (config: any) => any;
  createReport: (plan: any, results: any[], config: any) => any;
  executePlan: (
    plan: any,
    config: any,
    fetchImplementation?: jest.Mock,
  ) => Promise<any[]>;
  exitCodeFor: (report: any) => number;
  main: (options?: Record<string, unknown>) => Promise<number>;
  safeBodySnippet: (value: unknown) => string;
};

const smoke = require('../../../../scripts/api-smoke-test.js') as SmokeModule;

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: jest.fn().mockResolvedValue(JSON.stringify(body)),
  };
}

describe('API smoke gate', () => {
  it('contains only explicit, versioned, read-only endpoints', () => {
    expect(
      smoke.API_ENDPOINTS.map(({ name, method, path }) => ({
        name,
        method,
        path,
      })),
    ).toEqual([
      { name: 'health', method: 'GET', path: '/api/v1/health' },
      { name: 'auth-profile', method: 'GET', path: '/api/v1/auth/me' },
      {
        name: 'auth-contexts',
        method: 'GET',
        path: '/api/v1/auth/contexts',
      },
      {
        name: 'auth-permissions',
        method: 'GET',
        path: '/api/v1/auth/permissions',
      },
      {
        name: 'dashboard-summary',
        method: 'GET',
        path: '/api/v1/dashboard/summary',
      },
    ]);
    for (const endpoint of smoke.API_ENDPOINTS) {
      expect(endpoint.method).toBe('GET');
      expect(endpoint.path).toMatch(/^\/api\/v1\//);
      expect(endpoint.path).not.toMatch(
        /number(?:ing|sequence)|inventory.*(?:create|adjust|issue|transfer)/i,
      );
    }
  });

  it('rejects unsafe base URLs and incomplete operational context', () => {
    expect(() =>
      smoke.buildConfig(
        { ATSOFT_API_BASE_URL: 'http://user:secret@localhost:4000' },
        [],
      ),
    ).toThrow(/without credentials/i);
    expect(() =>
      smoke.buildConfig(
        {
          ATSOFT_API_TOKEN: 'token',
          ATSOFT_ACTIVE_COMPANY_ID: 'company-a',
        },
        [],
      ),
    ).toThrow(/must be supplied together/i);
    expect(() =>
      smoke.buildConfig(
        {
          ATSOFT_ACTIVE_COMPANY_ID: 'company-a',
          ATSOFT_ACTIVE_BRANCH_ID: 'branch-a',
        },
        [],
      ),
    ).toThrow(/token is required/i);
  });

  it('runs the public health check while clearly classifying missing auth as a limitation', () => {
    const config = smoke.buildConfig({}, []);
    const plan = smoke.buildPlan(config);

    expect(plan.checks.map((endpoint: SmokeEndpoint) => endpoint.name)).toEqual([
      'health',
    ]);
    expect(plan.skipped).toHaveLength(4);
    expect(plan.limitations).toEqual([
      'AUTHENTICATED_READS_SKIPPED_TOKEN_NOT_PROVIDED',
    ]);
  });

  it('executes authenticated and context reads with env-derived headers and no request body', async () => {
    const config = smoke.buildConfig(
      {
        ATSOFT_API_BASE_URL: 'http://127.0.0.1:4010',
        ATSOFT_API_TOKEN: 'runtime-token',
        ATSOFT_ACTIVE_COMPANY_ID: 'company-a',
        ATSOFT_ACTIVE_BRANCH_ID: 'branch-a',
        ATSOFT_ACTIVE_ADMINISTRATION_ID: 'administration-a',
        ATSOFT_ACTIVE_DEPARTMENT_ID: 'department-a',
      },
      [],
    );
    const plan = smoke.buildPlan(config);
    const payloads: Record<string, unknown> = {
      '/api/v1/health': { status: 'ok' },
      '/api/v1/auth/me': { id: 'user-a' },
      '/api/v1/auth/contexts': { contexts: [] },
      '/api/v1/auth/permissions': { roles: [], permissions: [] },
      '/api/v1/dashboard/summary': {},
    };
    const fetchImplementation = jest.fn(
      async (url: string, options: Record<string, any>) => {
        expect(options.method).toBe('GET');
        expect(options).not.toHaveProperty('body');
        return jsonResponse(200, payloads[new URL(url).pathname]);
      },
    );

    const results = await smoke.executePlan(
      plan,
      config,
      fetchImplementation,
    );
    const report = smoke.createReport(plan, results, config);

    expect(report.result).toBe('PASS');
    expect(report.passed).toBe(5);
    expect(report.failed).toBe(0);
    expect(JSON.stringify(report)).not.toContain('runtime-token');
    expect(fetchImplementation).toHaveBeenCalledTimes(5);

    const profileCall = fetchImplementation.mock.calls.find(
      ([url]) => new URL(url).pathname === '/api/v1/auth/me',
    );
    expect(profileCall?.[1].headers).toMatchObject({
      Authorization: 'Bearer runtime-token',
    });

    const dashboardCall = fetchImplementation.mock.calls.find(
      ([url]) => new URL(url).pathname === '/api/v1/dashboard/summary',
    );
    expect(dashboardCall?.[1].headers).toMatchObject({
      Authorization: 'Bearer runtime-token',
      'x-active-company-id': 'company-a',
      'x-active-branch-id': 'branch-a',
      'x-active-administration-id': 'administration-a',
      'x-active-department-id': 'department-a',
    });
  });

  it('returns a non-zero gate result for an unexpected HTTP failure even in optional mode', async () => {
    const config = smoke.buildConfig({}, ['--optional']);
    const plan = smoke.buildPlan(config);
    const results = await smoke.executePlan(
      plan,
      config,
      jest.fn().mockResolvedValue(jsonResponse(500, { message: 'failure' })),
    );
    const report = smoke.createReport(plan, results, config);

    expect(report.result).toBe('FAIL');
    expect(report.failed).toBe(1);
    expect(smoke.exitCodeFor(report)).toBe(1);
  });

  it('allows optional offline QA to skip only when every attempted check is unreachable', async () => {
    const config = smoke.buildConfig({}, ['--optional']);
    const plan = smoke.buildPlan(config);
    const results = await smoke.executePlan(
      plan,
      config,
      jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
    );
    const report = smoke.createReport(plan, results, config);

    expect(report.result).toBe('SKIPPED_RUNTIME_UNAVAILABLE');
    expect(report.runtimeUnavailable).toBe(true);
    expect(report.limitations).toContain('API_RUNTIME_UNAVAILABLE_OPTIONAL_GATE');
    expect(smoke.exitCodeFor(report)).toBe(0);
  });

  it('redacts common secret fields from diagnostic response snippets', () => {
    const snippet = smoke.safeBodySnippet(
      JSON.stringify({
        accessToken: 'secret-token',
        password: 'secret-password',
        message: 'failure',
      }),
    );

    expect(snippet).toContain('"accessToken":"[REDACTED]"');
    expect(snippet).toContain('"password":"[REDACTED]"');
    expect(snippet).not.toContain('secret-token');
    expect(snippet).not.toContain('secret-password');
  });
});
