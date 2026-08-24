/**
 * Shared QA credentials — loaded from environment variables only.
 *
 * Required environment variables:
 *   QA_ADMIN_EMAIL    — login email for QA browser/API tests
 *   QA_ADMIN_PASSWORD — login password for QA browser/API tests
 *
 * These MUST be set before running any Playwright QA suite.
 * No fallback passwords are permitted.
 */

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `QA runtime credential not configured: ${name} environment variable is missing.`,
    );
  }
  return v;
}

export const QA_EMAIL: string = requireEnv('QA_ADMIN_EMAIL');
export const QA_PASSWORD: string = requireEnv('QA_ADMIN_PASSWORD');

export const QA_COMPANY_ID =
  process.env.QA_COMPANY_ID || 'cmrl31uuy0000ok959hdjnca6';
export const QA_BRANCH_ID =
  process.env.QA_BRANCH_ID || 'cmrx06a560000ng95g7d65vzh';
