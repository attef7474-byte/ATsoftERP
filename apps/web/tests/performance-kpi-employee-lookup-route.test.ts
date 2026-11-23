import * as fs from 'fs';
import * as path from 'path';

const repoRoot = path.resolve(__dirname, '..', '..', '..');
const page = path.join(repoRoot, 'apps', 'web', 'src', 'app', 'admin', 'performance', 'kpis', 'page.tsx');

describe('Performance KPI employee lookup route', () => {
  const source = fs.readFileSync(page, 'utf8');

  it('uses the canonical production operational people endpoint', () => {
    expect(source).toContain("api.get('/production/operational-people'");
  });

  it('does not regress to the obsolete core operational people endpoint', () => {
    expect(source).not.toContain('/core/operational-people');
  });
});
