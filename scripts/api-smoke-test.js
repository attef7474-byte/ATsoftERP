'use strict';

const DEFAULT_BASE_URL = 'http://localhost:4000';
const DEFAULT_TIMEOUT_MS = 10000;

class SmokeConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SmokeConfigurationError';
  }
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validateHealth(body) {
  return isRecord(body) && body.status === 'ok'
    ? null
    : 'Expected a JSON object with status="ok"';
}

function validateProfile(body) {
  const directId = isRecord(body) ? body.id : undefined;
  const nestedId =
    isRecord(body) && isRecord(body.user) ? body.user.id : undefined;
  return typeof directId === 'string' || typeof nestedId === 'string'
    ? null
    : 'Expected the authenticated profile to contain a user id';
}

function validateContexts(body) {
  return isRecord(body) && Array.isArray(body.contexts)
    ? null
    : 'Expected the contexts response to contain a contexts array';
}

function validatePermissions(body) {
  return isRecord(body) &&
    Array.isArray(body.roles) &&
    Array.isArray(body.permissions)
    ? null
    : 'Expected the permissions response to contain roles and permissions arrays';
}

function validateObject(body) {
  return isRecord(body) ? null : 'Expected a JSON object response';
}

const API_ENDPOINTS = Object.freeze([
  Object.freeze({
    name: 'health',
    method: 'GET',
    path: '/api/v1/health',
    requiresAuth: false,
    requiresContext: false,
    validate: validateHealth,
  }),
  Object.freeze({
    name: 'auth-profile',
    method: 'GET',
    path: '/api/v1/auth/me',
    requiresAuth: true,
    requiresContext: false,
    validate: validateProfile,
  }),
  Object.freeze({
    name: 'auth-contexts',
    method: 'GET',
    path: '/api/v1/auth/contexts',
    requiresAuth: true,
    requiresContext: false,
    validate: validateContexts,
  }),
  Object.freeze({
    name: 'auth-permissions',
    method: 'GET',
    path: '/api/v1/auth/permissions',
    requiresAuth: true,
    requiresContext: false,
    validate: validatePermissions,
  }),
  Object.freeze({
    name: 'dashboard-summary',
    method: 'GET',
    path: '/api/v1/dashboard/summary',
    requiresAuth: true,
    requiresContext: true,
    validate: validateObject,
  }),
]);

function readEnvironmentValue(environment, name) {
  const value = environment[name];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function normalizeBaseUrl(value) {
  const candidate = value || DEFAULT_BASE_URL;
  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new SmokeConfigurationError(
      'ATSOFT_API_BASE_URL must be a valid HTTP(S) origin',
    );
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new SmokeConfigurationError(
      'ATSOFT_API_BASE_URL must use HTTP or HTTPS',
    );
  }
  if (
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    (parsed.pathname && parsed.pathname !== '/')
  ) {
    throw new SmokeConfigurationError(
      'ATSOFT_API_BASE_URL must contain only the API origin, without credentials, path, query, or fragment',
    );
  }
  return parsed.origin;
}

function parseTimeout(value) {
  if (value === undefined) return DEFAULT_TIMEOUT_MS;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 100 || parsed > 120000) {
    throw new SmokeConfigurationError(
      'ATSOFT_SMOKE_TIMEOUT_MS must be an integer between 100 and 120000',
    );
  }
  return parsed;
}

function buildConfig(
  environment = process.env,
  argumentsList = process.argv.slice(2),
) {
  const supportedArguments = new Set(['--optional', '--json']);
  const unknownArguments = argumentsList.filter(
    (argument) => !supportedArguments.has(argument),
  );
  if (unknownArguments.length > 0) {
    throw new SmokeConfigurationError(
      'Unknown smoke argument(s): ' + unknownArguments.join(', '),
    );
  }

  const token = readEnvironmentValue(environment, 'ATSOFT_API_TOKEN');
  const companyId = readEnvironmentValue(
    environment,
    'ATSOFT_ACTIVE_COMPANY_ID',
  );
  const branchId = readEnvironmentValue(
    environment,
    'ATSOFT_ACTIVE_BRANCH_ID',
  );
  const administrationId = readEnvironmentValue(
    environment,
    'ATSOFT_ACTIVE_ADMINISTRATION_ID',
  );
  const departmentId = readEnvironmentValue(
    environment,
    'ATSOFT_ACTIVE_DEPARTMENT_ID',
  );

  if ((companyId && !branchId) || (!companyId && branchId)) {
    throw new SmokeConfigurationError(
      'ATSOFT_ACTIVE_COMPANY_ID and ATSOFT_ACTIVE_BRANCH_ID must be supplied together',
    );
  }
  if ((administrationId || departmentId) && (!companyId || !branchId)) {
    throw new SmokeConfigurationError(
      'Administration or department context requires company and branch context',
    );
  }
  if ((companyId || branchId) && !token) {
    throw new SmokeConfigurationError(
      'ATSOFT_API_TOKEN is required when operational context is supplied',
    );
  }
  if (token && /^Bearer\s+/i.test(token)) {
    throw new SmokeConfigurationError(
      'ATSOFT_API_TOKEN must contain the raw token without the Bearer prefix',
    );
  }

  return Object.freeze({
    baseUrl: normalizeBaseUrl(
      readEnvironmentValue(environment, 'ATSOFT_API_BASE_URL'),
    ),
    token,
    companyId,
    branchId,
    administrationId,
    departmentId,
    timeoutMs: parseTimeout(
      readEnvironmentValue(environment, 'ATSOFT_SMOKE_TIMEOUT_MS'),
    ),
    optional: argumentsList.includes('--optional'),
    json: argumentsList.includes('--json'),
  });
}

function buildPlan(config) {
  const checks = [];
  const skipped = [];
  const limitations = [];

  for (const endpoint of API_ENDPOINTS) {
    if (endpoint.requiresAuth && !config.token) {
      skipped.push({
        name: endpoint.name,
        method: endpoint.method,
        path: endpoint.path,
        reason: 'ATSOFT_API_TOKEN_NOT_PROVIDED',
      });
      continue;
    }
    if (
      endpoint.requiresContext &&
      (!config.companyId || !config.branchId)
    ) {
      skipped.push({
        name: endpoint.name,
        method: endpoint.method,
        path: endpoint.path,
        reason: 'ATSOFT_OPERATIONAL_CONTEXT_NOT_PROVIDED',
      });
      continue;
    }
    checks.push(endpoint);
  }

  if (!config.token) {
    limitations.push('AUTHENTICATED_READS_SKIPPED_TOKEN_NOT_PROVIDED');
  } else if (!config.companyId || !config.branchId) {
    limitations.push('CONTEXT_READ_SKIPPED_CONTEXT_NOT_PROVIDED');
  }

  return { checks, skipped, limitations };
}

function headersFor(config, endpoint) {
  const headers = { Accept: 'application/json' };
  if (endpoint.requiresAuth) {
    headers.Authorization = 'Bearer ' + config.token;
  }
  if (endpoint.requiresContext) {
    headers['x-active-company-id'] = config.companyId;
    headers['x-active-branch-id'] = config.branchId;
    if (config.administrationId) {
      headers['x-active-administration-id'] = config.administrationId;
    }
    if (config.departmentId) {
      headers['x-active-department-id'] = config.departmentId;
    }
  }
  return headers;
}

function safeBodySnippet(value) {
  if (!value) return '';
  return String(value)
    .replace(
      /("(?:accessToken|refreshToken|token|password|passwordHash)"\s*:\s*)"[^"]*"/gi,
      '$1"[REDACTED]"',
    )
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 240);
}

async function readResponseBody(response) {
  const text = await response.text();
  if (!text) return { text: '', parsed: undefined };
  try {
    return { text, parsed: JSON.parse(text) };
  } catch {
    return { text, parsed: text };
  }
}

async function executeCheck(endpoint, config, fetchImplementation) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  const startedAt = Date.now();

  try {
    const response = await fetchImplementation(config.baseUrl + endpoint.path, {
      method: endpoint.method,
      headers: headersFor(config, endpoint),
      redirect: 'manual',
      signal: controller.signal,
    });
    const body = await readResponseBody(response);
    const durationMs = Date.now() - startedAt;

    if (!response.ok) {
      return {
        status: 'FAIL',
        name: endpoint.name,
        method: endpoint.method,
        path: endpoint.path,
        httpStatus: response.status,
        durationMs,
        failureType: 'HTTP',
        message:
          'Unexpected HTTP ' +
          response.status +
          (body.text ? ': ' + safeBodySnippet(body.text) : ''),
      };
    }

    const validationError = endpoint.validate(body.parsed);
    if (validationError) {
      return {
        status: 'FAIL',
        name: endpoint.name,
        method: endpoint.method,
        path: endpoint.path,
        httpStatus: response.status,
        durationMs,
        failureType: 'CONTRACT',
        message: validationError,
      };
    }

    return {
      status: 'PASS',
      name: endpoint.name,
      method: endpoint.method,
      path: endpoint.path,
      httpStatus: response.status,
      durationMs,
    };
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    const isTimeout = error && error.name === 'AbortError';
    return {
      status: 'FAIL',
      name: endpoint.name,
      method: endpoint.method,
      path: endpoint.path,
      durationMs,
      failureType: isTimeout ? 'TIMEOUT' : 'NETWORK',
      message: isTimeout
        ? 'Request exceeded ' + config.timeoutMs + 'ms'
        : safeBodySnippet(error && error.message ? error.message : error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function executePlan(
  plan,
  config,
  fetchImplementation = globalThis.fetch,
) {
  if (typeof fetchImplementation !== 'function') {
    throw new SmokeConfigurationError(
      'This smoke test requires a runtime with the Fetch API (Node.js 20+)',
    );
  }

  const results = [];
  for (const endpoint of plan.checks) {
    results.push(
      await executeCheck(endpoint, config, fetchImplementation),
    );
  }
  return results;
}

function createReport(plan, results, config) {
  const passed = results.filter((result) => result.status === 'PASS').length;
  const failures = results.filter((result) => result.status === 'FAIL');
  const optionalRuntimeUnavailable =
    config.optional &&
    passed === 0 &&
    failures.length > 0 &&
    failures.every(
      (failure) =>
        failure.failureType === 'NETWORK' ||
        failure.failureType === 'TIMEOUT',
    );
  const limitations = [...plan.limitations];
  if (optionalRuntimeUnavailable) {
    limitations.push('API_RUNTIME_UNAVAILABLE_OPTIONAL_GATE');
  }

  return {
    result:
      failures.length === 0
        ? limitations.length > 0
          ? 'PARTIAL'
          : 'PASS'
        : optionalRuntimeUnavailable
          ? 'SKIPPED_RUNTIME_UNAVAILABLE'
          : 'FAIL',
    baseUrl: config.baseUrl,
    timeoutMs: config.timeoutMs,
    passed,
    failed: optionalRuntimeUnavailable ? 0 : failures.length,
    runtimeUnavailable: optionalRuntimeUnavailable,
    skipped: plan.skipped.length,
    endpointsChecked: results.map((result) => result.path),
    limitations,
    checks: results,
    skippedChecks: plan.skipped,
  };
}

function exitCodeFor(report) {
  if (report.result === 'FAIL') return 1;
  return 0;
}

function formatTextReport(report) {
  const lines = ['ATSOFT_API_SMOKE_TEST'];
  for (const check of report.checks) {
    const status =
      report.runtimeUnavailable && check.status === 'FAIL'
        ? 'SKIP'
        : check.status;
    let line =
      status +
      ' ' +
      check.name +
      ' ' +
      check.method +
      ' ' +
      check.path;
    if (check.httpStatus) line += ' HTTP=' + check.httpStatus;
    line += ' DURATION_MS=' + check.durationMs;
    if (check.message) line += ' MESSAGE=' + check.message;
    lines.push(line);
  }
  for (const skipped of report.skippedChecks) {
    lines.push(
      'SKIP ' +
        skipped.name +
        ' ' +
        skipped.method +
        ' ' +
        skipped.path +
        ' REASON=' +
        skipped.reason,
    );
  }
  lines.push('ATSOFT_API_SMOKE_SUMMARY');
  lines.push('RESULT=' + report.result);
  lines.push('BASE_URL=' + report.baseUrl);
  lines.push('PASSED=' + report.passed);
  lines.push('FAILED=' + report.failed);
  lines.push('SKIPPED=' + report.skipped);
  lines.push(
    'ENDPOINTS_CHECKED=' +
      (report.endpointsChecked.length
        ? report.endpointsChecked.join(',')
        : 'NONE'),
  );
  lines.push(
    'LIMITATIONS=' +
      (report.limitations.length ? report.limitations.join(',') : 'NONE'),
  );
  return lines.join('\n');
}

async function main(options = {}) {
  const environment = options.environment || process.env;
  const argumentsList =
    options.argumentsList || process.argv.slice(2);
  const write = options.write || ((message) => console.log(message));

  let config;
  try {
    config = buildConfig(environment, argumentsList);
  } catch (error) {
    const message =
      error instanceof SmokeConfigurationError
        ? error.message
        : 'Unknown smoke configuration error';
    if (argumentsList.includes('--json')) {
      write(
        JSON.stringify({
          result: 'CONFIGURATION_ERROR',
          message,
        }),
      );
    } else {
      write(
        [
          'ATSOFT_API_SMOKE_SUMMARY',
          'RESULT=CONFIGURATION_ERROR',
          'MESSAGE=' + message,
        ].join('\n'),
      );
    }
    return 2;
  }

  const plan = buildPlan(config);
  const results = await executePlan(
    plan,
    config,
    options.fetchImplementation || globalThis.fetch,
  );
  const report = createReport(plan, results, config);
  write(config.json ? JSON.stringify(report) : formatTextReport(report));
  return exitCodeFor(report);
}

if (require.main === module) {
  main()
    .then((exitCode) => {
      process.exitCode = exitCode;
    })
    .catch((error) => {
      console.error('ATSOFT_API_SMOKE_FATAL=' + safeBodySnippet(error.message));
      process.exitCode = 2;
    });
}

module.exports = {
  API_ENDPOINTS,
  SmokeConfigurationError,
  buildConfig,
  buildPlan,
  createReport,
  executePlan,
  exitCodeFor,
  formatTextReport,
  headersFor,
  main,
  normalizeBaseUrl,
  safeBodySnippet,
};
