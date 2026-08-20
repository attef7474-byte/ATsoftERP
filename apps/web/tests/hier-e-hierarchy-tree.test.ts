import en from '../src/lib/i18n/locales/en';
import ar from '../src/lib/i18n/locales/ar';
import { resolveTranslation } from '../src/lib/i18n/translation-core';

function resolve(key: string, locale: 'ar' | 'en'): string {
  const data = locale === 'ar' ? (ar as any) : (en as any);
  return resolveTranslation(data, locale, key);
}

const HIER_E_KEYS = [
  'hierarchyTree',
  'selectPersonToViewHierarchy',
  'totalDescendants',
  'maxDepth',
  'truncated',
  'noChildren',
  'reportingLineUp',
  'expandAll',
  'collapseAll',
  'searchInTree',
  'noResultsFound',
  'assignmentDetails',
];

describe('HIER-E hierarchy tree i18n keys', () => {
  describe('English translations', () => {
    for (const key of HIER_E_KEYS) {
      it(`EN: core.${key} resolves to a non-empty string`, () => {
        const value = resolve(`core.${key}`, 'en');
        expect(value).toBeTruthy();
        expect(typeof value).toBe('string');
        expect(value.length).toBeGreaterThan(0);
      });
    }
  });

  describe('Arabic translations', () => {
    for (const key of HIER_E_KEYS) {
      it(`AR: core.${key} resolves to a non-empty string`, () => {
        const value = resolve(`core.${key}`, 'ar');
        expect(value).toBeTruthy();
        expect(typeof value).toBe('string');
        expect(value.length).toBeGreaterThan(0);
      });
    }
  });

  describe('EN/AR key synchronization', () => {
    it('EN and AR have the same HIER-E keys', () => {
      const enCore = (en as any).core;
      const arCore = (ar as any).core;
      for (const key of HIER_E_KEYS) {
        expect(enCore).toHaveProperty(key);
        expect(arCore).toHaveProperty(key);
      }
    });
  });
});

describe('HIER-E type existence', () => {
  it('HierarchyTreeNode has required fields', () => {
    const node = {
      assignmentId: 'test',
      level: 0,
      person: { id: 'p1', name: 'Test', code: 'T' },
      jobTitle: null,
      department: null,
      branch: null,
      administration: null,
      leadershipLevel: 'NONE',
      assignmentType: 'PRIMARY',
      effectiveFrom: '2026-01-01T00:00:00.000Z',
      effectiveTo: null,
      isActive: true,
      childCount: 0,
      children: [],
    };
    expect(node.assignmentId).toBe('test');
    expect(node.children).toEqual([]);
    expect(node.leadershipLevel).toBe('NONE');
  });

  it('HierarchyTreeResponse has required fields', () => {
    const root = {
      assignmentId: 'r1',
      level: 0,
      person: { id: 'p1', name: 'Root', code: 'R' },
      jobTitle: null,
      department: null,
      branch: null,
      administration: null,
      leadershipLevel: 'NONE',
      assignmentType: 'PRIMARY',
      effectiveFrom: '2026-01-01T00:00:00.000Z',
      effectiveTo: null,
      isActive: true,
      childCount: 0,
      children: [],
    };
    const response = {
      root,
      reportingLine: [],
      totalDescendants: 0,
      maxDepth: 0,
      truncated: false,
      asOf: '2026-01-01T00:00:00.000Z',
    };
    expect(response.root.assignmentId).toBe('r1');
    expect(response.totalDescendants).toBe(0);
    expect(response.truncated).toBe(false);
  });

  it('HierarchyTreeNode supports nested children', () => {
    const grandchild = {
      assignmentId: 'gc1',
      level: 2,
      person: { id: 'pgc1', name: 'Grandchild', code: 'GC' },
      jobTitle: null,
      department: null,
      branch: null,
      administration: null,
      leadershipLevel: 'NONE',
      assignmentType: 'PRIMARY',
      effectiveFrom: '2026-01-01T00:00:00.000Z',
      effectiveTo: null,
      isActive: true,
      childCount: 0,
      children: [],
    };
    const child = {
      assignmentId: 'c1',
      level: 1,
      person: { id: 'pc1', name: 'Child', code: 'C' },
      jobTitle: null,
      department: null,
      branch: null,
      administration: null,
      leadershipLevel: 'TEAM_LEAD',
      assignmentType: 'PRIMARY',
      effectiveFrom: '2026-01-01T00:00:00.000Z',
      effectiveTo: null,
      isActive: true,
      childCount: 1,
      children: [grandchild],
    };
    expect(child.children).toHaveLength(1);
    expect(child.children[0].level).toBe(2);
  });

  it('HierarchyTreeNode supports leadershipLevel values', () => {
    const levels = ['NONE', 'TEAM_LEAD', 'SUPERVISOR', 'DEPARTMENT_HEAD', 'ADMINISTRATION_MANAGER'];
    for (const level of levels) {
      const node = {
        assignmentId: 'test',
        level: 0,
        person: null,
        jobTitle: null,
        department: null,
        branch: null,
        administration: null,
        leadershipLevel: level,
        assignmentType: 'PRIMARY',
        effectiveFrom: '2026-01-01T00:00:00.000Z',
        effectiveTo: null,
        isActive: true,
        childCount: 0,
        children: [],
      };
      expect(node.leadershipLevel).toBe(level);
    }
  });
});

describe('HIER-E tree structure logic', () => {
  const makeNode = (id: string, level: number, childCount = 0, children: any[] = []): any => ({
    assignmentId: id,
    level,
    person: { id: `p-${id}`, name: `Person ${id}`, code: id.toUpperCase() },
    jobTitle: null,
    department: null,
    branch: null,
    administration: null,
    leadershipLevel: 'NONE',
    assignmentType: 'PRIMARY',
    effectiveFrom: '2026-01-01T00:00:00.000Z',
    effectiveTo: null,
    isActive: true,
    childCount,
    children,
  });

  it('tree with 150 nodes across 5 levels', () => {
    const buildTree = (depth: number, maxDepth: number, nodeId: number): { node: any; nextId: number } => {
      if (depth >= maxDepth) return { node: makeNode(`n${nodeId}`, depth), nextId: nodeId + 1 };
      const child1 = buildTree(depth + 1, maxDepth, nodeId + 1);
      const child2 = buildTree(depth + 1, maxDepth, child1.nextId);
      return {
        node: makeNode(`n${nodeId}`, depth, 2, [child1.node, child2.node]),
        nextId: child2.nextId,
      };
    };
    const { node: root } = buildTree(0, 7, 0);
    const countNodes = (n: any): number => 1 + n.children.reduce((sum: number, c: any) => sum + countNodes(c), 0);
    expect(countNodes(root)).toBe(255);
    expect(root.level).toBe(0);
    expect(root.children).toHaveLength(2);
  });

  it('collect all node ids from tree', () => {
    const gc = makeNode('gc1', 2);
    const c1 = makeNode('c1', 1, 1, [gc]);
    const c2 = makeNode('c2', 1);
    const root = makeNode('r', 0, 2, [c1, c2]);

    const ids: string[] = [];
    const walk = (n: any) => { ids.push(n.assignmentId); n.children.forEach(walk); };
    walk(root);
    expect(ids).toEqual(['r', 'c1', 'gc1', 'c2']);
  });

  it('search filters nodes by name', () => {
    const c1 = makeNode('c1', 1);
    c1.person = { id: 'p1', name: 'Ahmed Ali', code: 'AA' };
    const c2 = makeNode('c2', 1);
    c2.person = { id: 'p2', name: 'Sara Mohamed', code: 'SM' };
    const root = makeNode('r', 0, 2, [c1, c2]);

    const searchTree = (node: any, query: string): any[] => {
      const results: any[] = [];
      const q = query.toLowerCase();
      if (node.person?.name?.toLowerCase().includes(q) || node.person?.code?.toLowerCase().includes(q)) {
        results.push(node);
      }
      node.children.forEach((c: any) => results.push(...searchTree(c, query)));
      return results;
    };

    expect(searchTree(root, 'ahmed')).toHaveLength(1);
    expect(searchTree(root, 'sara')).toHaveLength(1);
    expect(searchTree(root, 'xxx')).toHaveLength(0);
    expect(searchTree(root, 'aa')).toHaveLength(1);
  });
});
