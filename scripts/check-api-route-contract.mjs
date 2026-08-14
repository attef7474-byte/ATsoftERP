import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const webRoot = path.join(repoRoot, 'apps', 'web', 'src');
const apiRoot = path.join(repoRoot, 'apps', 'api', 'src');
const appModulePath = path.join(apiRoot, 'app.module.ts');
const lookupAdaptersPath = path.join(webRoot, 'components', 'f9', 'lookup-adapters.ts');

const HTTP_METHODS = ['get', 'post', 'patch', 'put', 'delete'];
const sourceExtensions = new Set(['.ts', '.tsx']);

function toPosix(value) {
  return value.split(path.sep).join('/');
}

function relative(value) {
  return toPosix(path.relative(repoRoot, value));
}

function walk(directory, predicate) {
  const results = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      results.push(...walk(fullPath, predicate));
    } else if (predicate(fullPath)) {
      results.push(fullPath);
    }
  }
  return results;
}

function lineAt(source, index) {
  return source.slice(0, index).split('\n').length;
}

function skipQuoted(source, index, quote) {
  let cursor = index + 1;
  while (cursor < source.length) {
    if (source[cursor] === '\\') {
      cursor += 2;
      continue;
    }
    if (source[cursor] === quote) return cursor + 1;
    cursor += 1;
  }
  return source.length;
}

function findClosing(source, openIndex, openChar, closeChar) {
  let depth = 0;
  let cursor = openIndex;
  while (cursor < source.length) {
    const char = source[cursor];
    if (char === "'" || char === '"' || char === '`') {
      cursor = skipQuoted(source, cursor, char);
      continue;
    }
    if (source.startsWith('//', cursor)) {
      const end = source.indexOf('\n', cursor + 2);
      cursor = end === -1 ? source.length : end + 1;
      continue;
    }
    if (source.startsWith('/*', cursor)) {
      const end = source.indexOf('*/', cursor + 2);
      cursor = end === -1 ? source.length : end + 2;
      continue;
    }
    if (char === openChar) depth += 1;
    if (char === closeChar) {
      depth -= 1;
      if (depth === 0) return cursor;
    }
    cursor += 1;
  }
  return -1;
}

function splitTopLevel(source, delimiter = ',') {
  const results = [];
  let start = 0;
  let cursor = 0;
  const stack = [];
  while (cursor < source.length) {
    const char = source[cursor];
    if (char === "'" || char === '"' || char === '`') {
      cursor = skipQuoted(source, cursor, char);
      continue;
    }
    if ('([{<'.includes(char)) stack.push(char);
    if (')]}>' .includes(char)) stack.pop();
    if (char === delimiter && stack.length === 0) {
      results.push(source.slice(start, cursor).trim());
      start = cursor + 1;
    }
    cursor += 1;
  }
  results.push(source.slice(start).trim());
  return results;
}

function resolveLocalImport(fromFile, specifier) {
  if (!specifier.startsWith('.')) return null;
  const unresolved = path.resolve(path.dirname(fromFile), specifier);
  const candidates = [
    `${unresolved}.ts`,
    `${unresolved}.tsx`,
    path.join(unresolved, 'index.ts'),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
}

function parseImports(filePath, source) {
  const imports = new Map();
  const pattern = /import\s+(type\s+)?([\s\S]*?)\s+from\s+['"]([^'"]+)['"]\s*;?/g;
  for (const match of source.matchAll(pattern)) {
    if (match[1]) continue;
    const target = resolveLocalImport(filePath, match[3]);
    if (!target) continue;
    const clause = match[2].trim();
    const namedStart = clause.indexOf('{');
    if (namedStart !== -1) {
      const namedEnd = clause.lastIndexOf('}');
      for (const item of clause.slice(namedStart + 1, namedEnd).split(',')) {
        const [imported, local] = item.trim().split(/\s+as\s+/);
        if (imported) imports.set(local || imported, target);
      }
    }
    const defaultPart = clause.split(',')[0].trim();
    if (defaultPart && !defaultPart.startsWith('{') && !defaultPart.startsWith('*')) {
      imports.set(defaultPart, target);
    }
  }
  return imports;
}

function decoratorObject(source, decoratorName) {
  const marker = `@${decoratorName}`;
  const decoratorIndex = source.indexOf(marker);
  if (decoratorIndex === -1) return null;
  const openParen = source.indexOf('(', decoratorIndex + marker.length);
  if (openParen === -1) return null;
  const closeParen = findClosing(source, openParen, '(', ')');
  if (closeParen === -1) return null;
  return source.slice(openParen + 1, closeParen);
}

function decoratorArgsAt(source, decoratorIndex, decoratorName) {
  const openParen = source.indexOf('(', decoratorIndex + decoratorName.length + 1);
  if (openParen === -1) return null;
  const closeParen = findClosing(source, openParen, '(', ')');
  if (closeParen === -1) return null;
  return { args: source.slice(openParen + 1, closeParen), closeParen };
}

function arrayProperty(objectSource, property) {
  const match = new RegExp(`\\b${property}\\s*:`).exec(objectSource);
  if (!match) return '';
  const openBracket = objectSource.indexOf('[', match.index + match[0].length);
  if (openBracket === -1) return '';
  const closeBracket = findClosing(objectSource, openBracket, '[', ']');
  return closeBracket === -1 ? '' : objectSource.slice(openBracket + 1, closeBracket);
}

function collectRegisteredControllerFiles() {
  const visitedModules = new Set();
  const controllerFiles = new Set();
  const controllerClasses = new Map();

  function visitModule(modulePath) {
    const normalized = path.resolve(modulePath);
    if (visitedModules.has(normalized)) return;
    visitedModules.add(normalized);

    const source = fs.readFileSync(normalized, 'utf8');
    const moduleObject = decoratorObject(source, 'Module');
    if (moduleObject === null) return;
    const imports = parseImports(normalized, source);

    const controllersSource = arrayProperty(moduleObject, 'controllers');
    for (const identifier of controllersSource.match(/[A-Za-z_$][\w$]*/g) ?? []) {
      const target = imports.get(identifier);
      if (target?.endsWith('.controller.ts')) {
        controllerFiles.add(target);
        if (!controllerClasses.has(target)) controllerClasses.set(target, new Set());
        controllerClasses.get(target).add(identifier);
      }
    }

    const modulesSource = arrayProperty(moduleObject, 'imports');
    for (const identifier of modulesSource.match(/[A-Za-z_$][\w$]*/g) ?? []) {
      const target = imports.get(identifier);
      if (target?.endsWith('.module.ts')) visitModule(target);
    }
  }

  visitModule(appModulePath);
  return { controllerFiles, controllerClasses, moduleFiles: visitedModules };
}

function firstString(source) {
  const match = /(['"])(.*?)\1/s.exec(source);
  return match ? match[2] : '';
}

function normalizePath(value) {
  let normalized = value.trim();
  normalized = normalized.replace(/^[A-Za-z][A-Za-z\d+.-]*:\/\/[^/]+/, '');
  normalized = normalized.replace(/^\/api\/v1(?=\/|$)/, '');
  normalized = normalized.split('?')[0].split('#')[0];
  normalized = normalized.replace(/\/{2,}/g, '/');
  if (normalized.length > 1) normalized = normalized.replace(/\/$/, '');
  return normalized || '/';
}

function joinRoute(root, child) {
  return normalizePath(`/${[root, child].filter(Boolean).join('/')}`);
}

function backendHandlerSignature(source, decoratorCloseParen, classCloseBrace) {
  let cursor = decoratorCloseParen + 1;

  while (cursor < classCloseBrace) {
    while (/\s/.test(source[cursor] ?? '')) cursor += 1;
    if (source[cursor] !== '@') break;

    cursor += 1;
    while (/[\w$.]/.test(source[cursor] ?? '')) cursor += 1;
    while (/\s/.test(source[cursor] ?? '')) cursor += 1;
    if (source[cursor] === '(') {
      const decoratorEnd = findClosing(source, cursor, '(', ')');
      if (decoratorEnd === -1 || decoratorEnd > classCloseBrace) return '';
      cursor = decoratorEnd + 1;
    } else {
      const lineEnd = source.indexOf('\n', cursor);
      cursor = lineEnd === -1 ? classCloseBrace : lineEnd + 1;
    }
  }

  while (/\s/.test(source[cursor] ?? '')) cursor += 1;
  const signatureStart = cursor;
  const parametersOpen = source.indexOf('(', signatureStart);
  if (parametersOpen === -1 || parametersOpen > classCloseBrace) return '';
  const parametersClose = findClosing(source, parametersOpen, '(', ')');
  if (parametersClose === -1 || parametersClose > classCloseBrace) return '';

  cursor = parametersClose + 1;
  const stack = [];
  while (cursor < classCloseBrace) {
    const char = source[cursor];
    if (char === "'" || char === '"' || char === '`') {
      cursor = skipQuoted(source, cursor, char);
      continue;
    }
    if (source.startsWith('//', cursor)) {
      const end = source.indexOf('\n', cursor + 2);
      cursor = end === -1 ? classCloseBrace : end + 1;
      continue;
    }
    if (source.startsWith('/*', cursor)) {
      const end = source.indexOf('*/', cursor + 2);
      cursor = end === -1 ? classCloseBrace : end + 2;
      continue;
    }
    if (char === '{' && stack.length === 0) {
      return source.slice(signatureStart, cursor).replace(/\s+/g, ' ').trim();
    }
    if ('([<'.includes(char)) stack.push(char);
    if (')]>'.includes(char)) stack.pop();
    cursor += 1;
  }
  return '';
}

function parseBackendRoutes(controllerFiles, controllerClasses) {
  const routes = [];
  for (const filePath of [...controllerFiles].sort()) {
    const source = fs.readFileSync(filePath, 'utf8');
    const controllerPattern = /@Controller\b/g;
    for (const controllerMatch of source.matchAll(controllerPattern)) {
      const controller = decoratorArgsAt(source, controllerMatch.index, 'Controller');
      if (!controller) continue;
      const pathProperty = /\bpath\s*:\s*(['"])(.*?)\1/s.exec(controller.args);
      const root = pathProperty ? pathProperty[2] : firstString(controller.args);
      const classIndex = source.indexOf('class ', controller.closeParen);
      const classOpenBrace = classIndex === -1 ? -1 : source.indexOf('{', classIndex);
      if (classOpenBrace === -1) continue;
      const className = /\bclass\s+([A-Za-z_$][\w$]*)/.exec(source.slice(classIndex, classOpenBrace))?.[1];
      if (!className || !controllerClasses.get(filePath)?.has(className)) continue;
      const classCloseBrace = findClosing(source, classOpenBrace, '{', '}');
      if (classCloseBrace === -1) continue;
      const classSource = source.slice(classOpenBrace + 1, classCloseBrace);
      const decoratorPattern = /@(Get|Post|Patch|Put|Delete)\b/g;
      for (const match of classSource.matchAll(decoratorPattern)) {
        const absoluteIndex = classOpenBrace + 1 + match.index;
        const openParen = source.indexOf('(', absoluteIndex + match[0].length);
        if (openParen === -1 || openParen > classCloseBrace) continue;
        const closeParen = findClosing(source, openParen, '(', ')');
        if (closeParen === -1 || closeParen > classCloseBrace) continue;
        const args = source.slice(openParen + 1, closeParen);
        const child = firstString(args);
        const signature = backendHandlerSignature(source, closeParen, classCloseBrace);
        routes.push({
          method: match[1].toUpperCase(),
          path: joinRoute(root, child),
          file: relative(filePath),
          line: lineAt(source, absoluteIndex),
          signature,
        });
      }
    }
  }
  return routes;
}

function templateToPattern(expression, constants, resolving) {
  let result = '';
  let cursor = 1;
  const end = expression.length - 1;
  while (cursor < end) {
    if (expression[cursor] === '\\') {
      result += expression[cursor + 1] ?? '';
      cursor += 2;
      continue;
    }
    if (expression.startsWith('${', cursor)) {
      const closeBrace = findClosing(expression, cursor + 1, '{', '}');
      if (closeBrace === -1) return null;
      const embedded = expression.slice(cursor + 2, closeBrace).trim();
      if (/^getApiBaseUrl\(\)$/.test(embedded)) {
        result += '';
      } else if (/^['"]\?/.test(embedded) || embedded.includes("'?' +") || embedded.includes('\"?\" +')) {
        result += '?dynamic';
      } else {
        const resolved = expressionToPattern(embedded, constants, resolving);
        result += resolved ?? ':dynamic';
      }
      cursor = closeBrace + 1;
      continue;
    }
    result += expression[cursor];
    cursor += 1;
  }
  return result;
}

function unquote(expression) {
  const quote = expression[0];
  if ((quote !== "'" && quote !== '"') || expression.at(-1) !== quote) return null;
  return expression.slice(1, -1).replace(/\\(['"\\])/g, '$1');
}

function constExpressions(source) {
  const values = new Map();
  const pattern = /\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*/g;
  for (const match of source.matchAll(pattern)) {
    const start = match.index + match[0].length;
    let cursor = start;
    const stack = [];
    while (cursor < source.length) {
      const char = source[cursor];
      if (char === "'" || char === '"' || char === '`') {
        cursor = skipQuoted(source, cursor, char);
        continue;
      }
      if ('([{'.includes(char)) stack.push(char);
      if (')]}'.includes(char)) stack.pop();
      if (char === ';' && stack.length === 0) break;
      if (char === '\n' && stack.length === 0 && source.slice(start, cursor).trim()) break;
      cursor += 1;
    }
    values.set(match[1], source.slice(start, cursor).trim());
  }
  return values;
}

function expressionToPattern(expression, constants, resolving = new Set()) {
  const value = expression.trim().replace(/\s+as\s+const$/, '').trim();
  if (!value) return null;
  const parts = splitTopLevel(value, '+');
  if (parts.length > 1) {
    let combined = '';
    for (const part of parts) {
      if (/^getApiBaseUrl\(\)$/.test(part.trim())) continue;
      const resolved = expressionToPattern(part, constants, resolving);
      if (resolved === null) {
        combined += ':dynamic';
      } else {
        combined += resolved;
      }
    }
    return combined;
  }
  const plain = unquote(value);
  if (plain !== null) return plain;
  if (value.startsWith('`') && value.endsWith('`')) return templateToPattern(value, constants, resolving);
  if (/^[A-Za-z_$][\w$]*$/.test(value) && constants.has(value) && !resolving.has(value)) {
    const nextResolving = new Set(resolving).add(value);
    return expressionToPattern(constants.get(value), constants, nextResolving);
  }
  return null;
}

function callOpenParen(source, afterMethod) {
  let cursor = afterMethod;
  while (/\s/.test(source[cursor] ?? '')) cursor += 1;
  if (source[cursor] === '<') {
    const closeGeneric = findClosing(source, cursor, '<', '>');
    if (closeGeneric === -1) return null;
    cursor = closeGeneric + 1;
  }
  while (/\s/.test(source[cursor] ?? '')) cursor += 1;
  return source[cursor] === '(' ? cursor : null;
}

function apiCallsInFile(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const constants = constExpressions(source);
  const calls = [];
  const callPattern = /\bapi\.(get|post|patch|put|delete)\b/g;
  for (const match of source.matchAll(callPattern)) {
    const openParen = callOpenParen(source, match.index + match[0].length);
    if (openParen === null) continue;
    const closeParen = findClosing(source, openParen, '(', ')');
    if (closeParen === -1) continue;
    const args = splitTopLevel(source.slice(openParen + 1, closeParen));
    const rawPath = args[0] ?? '';
    const resolved = expressionToPattern(rawPath, constants);
    const generic = source.slice(match.index + match[0].length, openParen).trim();
    const mappedArray = resolved === null && /^[A-Za-z_$][\w$]*$/.test(rawPath)
      ? /\b([A-Za-z_$][\w$]*)\.map\s*\(\s*\(?\s*([A-Za-z_$][\w$]*)/.exec(source.slice(Math.max(0, match.index - 300), match.index))
      : null;
    const mappedExpression = mappedArray?.[2] === rawPath ? constants.get(mappedArray[1]) : null;
    const mappedPaths = mappedExpression
      ? [...mappedExpression.matchAll(/(['"])(\/[^'"]+)\1/g)].map((entry) => entry[2])
      : [];
    for (const callPath of mappedPaths.length ? mappedPaths : [resolved]) {
      calls.push({
        method: match[1].toUpperCase(),
        path: callPath === null ? null : normalizePath(callPath),
        rawPath,
        responseType: generic.startsWith('<') ? generic.slice(1, -1).trim() : '',
        request: args[1] ?? '',
        file: relative(filePath),
        line: lineAt(source, match.index),
        sourceKind: mappedPaths.length ? 'mapped-api' : 'api',
      });
    }
  }

  const fetchPattern = /\bfetch\s*\(/g;
  for (const match of source.matchAll(fetchPattern)) {
    if (relative(filePath) === 'apps/web/src/lib/api.ts') continue;
    const openParen = source.indexOf('(', match.index);
    const closeParen = findClosing(source, openParen, '(', ')');
    if (closeParen === -1) continue;
    const args = splitTopLevel(source.slice(openParen + 1, closeParen));
    const rawPath = args[0] ?? '';
    const expanded = expressionToPattern(rawPath, constants);
    const rawOrExpanded = expanded ?? '';
    if (!rawPath.includes('getApiBaseUrl') && !rawOrExpanded.includes('/')) continue;
    const methodMatch = /\bmethod\s*:\s*['"](GET|POST|PATCH|PUT|DELETE)['"]/i.exec(args[1] ?? '');
    calls.push({
      method: (methodMatch?.[1] ?? 'GET').toUpperCase(),
      path: expanded === null ? null : normalizePath(expanded),
      rawPath,
      responseType: '',
      request: args[1] ?? '',
      file: relative(filePath),
      line: lineAt(source, match.index),
      sourceKind: 'fetch',
    });
  }
  return calls;
}

function lookupAdapterContracts() {
  const source = fs.readFileSync(lookupAdaptersPath, 'utf8');
  const adapters = [];
  const pattern = /export\s+const\s+([A-Za-z_$][\w$]*)[^=]*=\s*\{/g;
  for (const match of source.matchAll(pattern)) {
    const openBrace = source.indexOf('{', match.index + match[0].length - 1);
    const closeBrace = findClosing(source, openBrace, '{', '}');
    if (closeBrace === -1) continue;
    const objectSource = source.slice(openBrace + 1, closeBrace);
    const endpointMatch = /\bendpoint\s*:\s*(['"])(.*?)\1/.exec(objectSource);
    if (!endpointMatch) continue;
    const detailMatch = /\bdetailEndpoint\s*:\s*(?:(['"])(.*?)\1|(null))/.exec(objectSource);
    adapters.push({
      name: match[1],
      endpoint: normalizePath(endpointMatch[2]),
      detailEndpoint: detailMatch ? (detailMatch[3] ? null : normalizePath(detailMatch[2])) : normalizePath(endpointMatch[2]),
      file: relative(lookupAdaptersPath),
      line: lineAt(source, match.index),
    });
  }
  return adapters;
}

function frontendCalls() {
  const files = walk(webRoot, (filePath) => sourceExtensions.has(path.extname(filePath)) && !/\.(?:spec|test)\.[jt]sx?$/.test(filePath));
  return files.flatMap(apiCallsInFile);
}

function activeF9AdapterNames() {
  const names = new Set();
  const files = walk(webRoot, (filePath) => path.extname(filePath) === '.tsx');
  for (const filePath of files) {
    const source = fs.readFileSync(filePath, 'utf8');
    for (const match of source.matchAll(/\badapter\s*=\s*\{\s*([A-Za-z_$][\w$]*)/g)) {
      if (match[1].endsWith('Adapter')) names.add(match[1]);
    }
  }
  return names;
}

function routeSegments(routePath) {
  return normalizePath(routePath).split('/').filter(Boolean);
}

function pathsMatch(frontendPath, backendPath) {
  const frontend = routeSegments(frontendPath);
  const backend = routeSegments(backendPath);
  const hasRuntimeDynamicSegment = frontend.includes(':dynamic');
  let frontIndex = 0;
  let backIndex = 0;
  while (frontIndex < frontend.length && backIndex < backend.length) {
    const front = frontend[frontIndex];
    const back = backend[backIndex];
    if (back.startsWith('*') || back.includes('*')) return true;
    if (back.startsWith(':') && front !== ':dynamic' && !hasRuntimeDynamicSegment) return false;
    if (front !== ':dynamic' && !back.startsWith(':') && front !== back) return false;
    frontIndex += 1;
    backIndex += 1;
  }
  return frontIndex === frontend.length && backIndex === backend.length;
}

function adapterDetailPathsMatch(frontendPath, backendPath) {
  const frontend = routeSegments(frontendPath);
  const backend = routeSegments(backendPath);
  if (frontend.length !== backend.length) return false;
  return frontend.every((segment, index) => {
    const backendSegment = backend[index];
    if (backendSegment.startsWith('*') || backendSegment.includes('*')) return true;
    if (segment === ':dynamic') return backendSegment.startsWith(':');
    return segment === backendSegment;
  });
}

function nearestRoutes(call, routes) {
  const firstSegment = routeSegments(call.path ?? '')[0];
  return routes
    .filter((route) => route.method === call.method || routeSegments(route.path)[0] === firstSegment)
    .map((route) => ({
      ...route,
      score:
        (route.method === call.method ? 4 : 0)
        + (routeSegments(route.path)[0] === firstSegment ? 3 : 0)
        + routeSegments(route.path).filter((segment) => routeSegments(call.path ?? '').includes(segment)).length,
    }))
    .sort((left, right) => right.score - left.score)
    .slice(0, 5);
}

function main() {
  const { controllerFiles, controllerClasses, moduleFiles } = collectRegisteredControllerFiles();
  const backendRoutes = parseBackendRoutes(controllerFiles, controllerClasses);
  const calls = frontendCalls();
  const adapters = lookupAdapterContracts();
  const f9Adapters = activeF9AdapterNames();
  const dynamicAdapterCall = (call) => call.rawPath.includes('adapter.endpoint') || (
    call.file === 'apps/web/src/components/f9/F9Lookup.tsx' && call.rawPath.includes('detailEndpoint')
  );
  const malformed = calls.filter((call) => !dynamicAdapterCall(call) && call.path !== null && !call.path.startsWith('/'));
  const unresolved = calls.filter((call) => !dynamicAdapterCall(call) && call.path === null);
  const directMismatches = calls
    .filter((call) => !dynamicAdapterCall(call))
    .filter((call) => call.path !== null && call.path.startsWith('/'))
    .filter((call) => !backendRoutes.some((route) => route.method === call.method && pathsMatch(call.path, route.path)))
    .map((call) => ({ ...call, nearest: nearestRoutes(call, backendRoutes) }));
  const adapterCalls = adapters.flatMap((adapter) => [
    {
      method: 'GET', path: adapter.endpoint, rawPath: `${adapter.name}.endpoint`, responseType: '', request: '',
      file: adapter.file, line: adapter.line, sourceKind: 'adapter-list', adapter: adapter.name,
    },
    ...(adapter.detailEndpoint === null || !f9Adapters.has(adapter.name) ? [] : [{
      method: 'GET', path: `${adapter.detailEndpoint}/:dynamic`, rawPath: `${adapter.name}.detailEndpoint`, responseType: '', request: '',
      file: adapter.file, line: adapter.line, sourceKind: 'adapter-detail', adapter: adapter.name,
    }]),
  ]);
  const adapterMismatches = adapterCalls
    .filter((call) => !backendRoutes.some((route) => route.method === call.method && (
      call.sourceKind === 'adapter-detail'
        ? adapterDetailPathsMatch(call.path, route.path)
        : pathsMatch(call.path, route.path)
    )))
    .map((call) => ({ ...call, nearest: nearestRoutes(call, backendRoutes) }));
  const mismatches = [...directMismatches, ...adapterMismatches];
  const matched = calls.length + adapterCalls.length
    - malformed.length
    - unresolved.length
    - mismatches.length;
  const frontendCallSites = new Set(calls.map((call) => `${call.file}:${call.line}:${call.method}:${call.rawPath}`)).size;
  const routeMap = [...calls, ...adapterCalls].map((call) => ({
    frontend: {
      method: call.method,
      path: call.path,
      rawPath: call.rawPath,
      file: call.file,
      line: call.line,
      sourceKind: call.sourceKind,
      request: call.request,
      responseType: call.responseType,
    },
    backend: call.path === null ? [] : backendRoutes
      .filter((route) => route.method === call.method && (
        call.sourceKind === 'adapter-detail'
          ? adapterDetailPathsMatch(call.path, route.path)
          : pathsMatch(call.path, route.path)
      ))
      .map((route) => ({ path: route.path, file: route.file, line: route.line, signature: route.signature })),
  }));

  const result = {
    summary: {
      registeredModules: moduleFiles.size,
      registeredControllerFiles: controllerFiles.size,
      registeredControllers: [...controllerClasses.values()].reduce((total, names) => total + names.size, 0),
      backendRoutes: backendRoutes.length,
      frontendCallSites,
      frontendRuntimeRoutes: calls.length,
      lookupAdapters: adapters.length,
      activeF9Adapters: f9Adapters.size,
      adapterRuntimeRoutes: adapterCalls.length,
      auditedRuntimeRoutes: calls.length + adapterCalls.length,
      matched,
      malformed: malformed.length,
      unresolved: unresolved.length,
      mismatches: mismatches.length,
    },
    malformed,
    unresolved,
    mismatches,
  };

  if (process.argv.includes('--map-json')) {
    console.log(JSON.stringify({ ...result, routeMap }, null, 2));
  } else if (process.argv.includes('--json')) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log('ATSOFT_API_ROUTE_CONTRACT');
    for (const [key, value] of Object.entries(result.summary)) {
      console.log(`${key.toUpperCase()}=${value}`);
    }
    for (const call of malformed) {
      console.error(`MALFORMED ${call.method} ${call.rawPath} at ${call.file}:${call.line}`);
    }
    for (const call of unresolved) {
      console.error(`UNRESOLVED ${call.method} ${call.rawPath} at ${call.file}:${call.line}`);
    }
    for (const call of mismatches) {
      console.error(`MISMATCH ${call.method} ${call.path} at ${call.file}:${call.line}`);
      for (const candidate of call.nearest.slice(0, 3)) {
        console.error(`  candidate ${candidate.method} ${candidate.path} (${candidate.file}:${candidate.line})`);
      }
    }
  }

  if (malformed.length || unresolved.length || mismatches.length) process.exitCode = 1;
}

main();
