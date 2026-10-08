import { readFileSync } from 'fs';
import { join } from 'path';

const LOGIN_PAGE = join(__dirname, '../src/app/login/page.tsx');
const source = readFileSync(LOGIN_PAGE, 'utf8');

describe('login form credential-leak regression (security)', () => {
  it('declares method="post" so a native submit can never serialise credentials into the URL', () => {
    const formTag = source.match(/<form\b[^>]*>/);
    expect(formTag).not.toBeNull();
    expect(formTag![0]).toMatch(/method=["']post["']/);
  });

  it('does not declare method="get" and never declares an action that could leak credentials', () => {
    const formTag = source.match(/<form\b[^>]*>/)![0];
    expect(formTag).not.toMatch(/method=["']get["']/i);
    expect(formTag).not.toMatch(/\baction=/i);
  });

  it('keeps the password field out of any GET-style URL construction', () => {
    // No code path may build a URL/query string from the password value.
    expect(source).not.toMatch(/[?&]password=/);
    expect(source).not.toMatch(/password=\$\{/);
    expect(source).not.toMatch(/URLSearchParams\([^)]*password/i);
    expect(source).not.toMatch(/router\.(push|replace)\([^)]*password/i);
  });

  it('preserves the client-side auth submit flow (handleSubmit + preventDefault)', () => {
    expect(source).toMatch(/<form[^>]*onSubmit=\{handleSubmit\}/);
    expect(source).toMatch(/preventDefault\(\)/);
  });

  it('still authenticates through the existing auth context flow, not a form post', () => {
    // Authentication is performed by the client-side useAuth().login() call, so the
    // native method="post" is never exercised on the happy path. This asserts the
    // existing contract is unchanged.
    expect(source).toMatch(/const \{[^}]*\blogin[^}]*\} = useAuth\(\)/);
    expect(source).toMatch(/await\s+authLogin\(email,\s*password\)/);
  });

  it('does not echo the password into console or UI state', () => {
    expect(source).not.toMatch(/console\.(log|debug|info|warn|error)\([^)]*password/i);
  });
});