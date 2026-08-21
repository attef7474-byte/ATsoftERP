'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { api } from '@/lib/api';
import { useTranslation } from '@/lib/i18n/use-translation';
import { Card, CardContent, LoadingState, EmptyState, Input, Button } from '@/components/admin/ui';
import { StatusBadge } from '@/components/admin/ui';
import { Search, ChevronRight, ChevronDown, TreePine, ArrowUp, ChevronUp } from 'lucide-react';
import type { HierarchyTreeNode, HierarchyTreeResponse } from '@/lib/admin-types';
import type { TranslationNamespace } from '@/lib/i18n';

interface HierarchyTreeProps {
  assignmentId: string;
  onViewHistory?: (personId: string, assignmentId: string) => void;
}

const LEADERSHIP_COLORS: Record<string, string> = {
  NONE: 'bg-gray-100 text-gray-600',
  TEAM_LEAD: 'bg-blue-100 text-blue-800',
  SUPERVISOR: 'bg-green-100 text-green-800',
  DEPARTMENT_HEAD: 'bg-purple-100 text-purple-800',
  ADMINISTRATION_MANAGER: 'bg-amber-100 text-amber-800',
};

function TreeNodeItem({
  node,
  expanded,
  onToggle,
  selectedId,
  onSelect,
  searchQuery,
  t,
  depth,
}: {
  node: HierarchyTreeNode;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  selectedId: string | null;
  onSelect: (node: HierarchyTreeNode) => void;
  searchQuery: string;
  t: (key: string, ns?: TranslationNamespace, params?: Record<string, string | number>) => string;
  depth: number;
}) {
  const isExpanded = expanded.has(node.assignmentId);
  const isSelected = selectedId === node.assignmentId;
  const hasChildren = node.children.length > 0;

  const matchesSearch = useMemo(() => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      node.person?.name?.toLowerCase().includes(q) ||
      node.person?.code?.toLowerCase().includes(q) ||
      node.jobTitle?.name?.toLowerCase().includes(q) ||
      node.department?.name?.toLowerCase().includes(q)
    );
  }, [node, searchQuery]);

  if (!matchesSearch) return null;

  return (
    <div>
      <div
        className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
          isSelected ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50 border border-transparent'
        }`}
        style={{ paddingLeft: `${depth * 24 + 12}px` }}
        onClick={() => {
          onSelect(node);
          if (hasChildren) onToggle(node.assignmentId);
        }}
      >
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggle(node.assignmentId);
            }}
            className="text-gray-400 hover:text-gray-600 flex-shrink-0"
          >
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        ) : (
          <span className="w-4 flex-shrink-0" />
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">{node.person?.name || '-'}</span>
            <span className="text-xs text-gray-400">{node.person?.code}</span>
            {node.leadershipLevel && node.leadershipLevel !== 'NONE' && (
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${LEADERSHIP_COLORS[node.leadershipLevel] || 'bg-gray-100 text-gray-600'}`}>
                {t(`core.leadershipLevels.${node.leadershipLevel}`)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
            {node.jobTitle && <span>{node.jobTitle.name}</span>}
            {node.department && <span className="text-gray-400">|</span>}
            {node.department && <span>{node.department.name}</span>}
            {node.childCount > 0 && (
              <span className="text-blue-500 ml-1">
                ({node.childCount} {t('core.directReports')})
              </span>
            )}
          </div>
        </div>
      </div>

      {isExpanded && hasChildren && (
        <div>
          {node.children.map((child) => (
            <TreeNodeItem
              key={child.assignmentId}
              node={child}
              expanded={expanded}
              onToggle={onToggle}
              selectedId={selectedId}
              onSelect={onSelect}
              searchQuery={searchQuery}
              t={t}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function HierarchyTree({ assignmentId, onViewHistory }: HierarchyTreeProps) {
  const { t } = useTranslation();
  const [data, setData] = useState<HierarchyTreeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedNode, setSelectedNode] = useState<HierarchyTreeNode | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  const loadHierarchy = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSelectedNode(null);
    setExpanded(new Set());
    setSearchQuery('');
    try {
      const res = await api.get<HierarchyTreeResponse>(`/supervisor-assignments/hierarchy/${assignmentId}`);
      setData(res);
      if (res.root) {
        setExpanded(new Set([res.root.assignmentId]));
        setSelectedNode(res.root);
      }
    } catch {
      setError(t('errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [assignmentId, t]);

  useEffect(() => {
    if (assignmentId) {
      loadHierarchy();
    }
  }, [assignmentId, loadHierarchy]);

  const toggleExpand = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    if (!data) return;
    const allIds = new Set<string>();
    const walk = (node: HierarchyTreeNode) => {
      allIds.add(node.assignmentId);
      node.children.forEach(walk);
    };
    walk(data.root);
    setExpanded(allIds);
  }, [data]);

  const collapseAll = useCallback(() => {
    setExpanded(data ? new Set([data.root.assignmentId]) : new Set());
  }, [data]);

  const filteredNodes = useMemo(() => {
    if (!data || !searchQuery) return null;
    const results: HierarchyTreeNode[] = [];
    const q = searchQuery.toLowerCase();
    const walk = (node: HierarchyTreeNode) => {
      if (
        node.person?.name?.toLowerCase().includes(q) ||
        node.person?.code?.toLowerCase().includes(q) ||
        node.jobTitle?.name?.toLowerCase().includes(q) ||
        node.department?.name?.toLowerCase().includes(q)
      ) {
        results.push(node);
      }
      node.children.forEach(walk);
    };
    walk(data.root);
    return results;
  }, [data, searchQuery]);

  if (loading) return <LoadingState />;
  if (error) return <EmptyState message={error} />;
  if (!data) return null;

  const formatDate = (d: string | null) => {
    if (!d) return t('core.notSpecified');
    return new Date(d).toLocaleDateString();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <TreePine className="h-5 w-5 text-blue-600" />
              {t('core.hierarchyTree')}
            </h2>
            <div className="flex items-center gap-2">
              <Button onClick={expandAll} variant="secondary" size="sm">
                {t('core.expandAll')}
              </Button>
              <Button onClick={collapseAll} variant="secondary" size="sm">
                {t('core.collapseAll')}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-4 text-sm">
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500">{t('core.totalDescendants')}</p>
              <p className="text-lg font-bold text-gray-900">{data.totalDescendants}</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500">{t('core.maxDepth')}</p>
              <p className="text-lg font-bold text-gray-900">{data.maxDepth}</p>
            </div>
            {data.truncated && (
              <div className="p-3 bg-amber-50 rounded-lg">
                <p className="text-xs text-amber-600">{t('core.truncated')}</p>
              </div>
            )}
          </div>

          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              ref={searchRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('core.searchInTree')}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {searchQuery && filteredNodes && (
            <div className="mb-3 text-sm text-gray-600">
              {filteredNodes.length} {t('core.noResultsFound').toLowerCase().includes('لم يتم') ? 'نتيجة' : 'results'}
            </div>
          )}

          <div className="border rounded-lg overflow-hidden">
            <TreeNodeItem
              node={data.root}
              expanded={expanded}
              onToggle={toggleExpand}
              selectedId={selectedNode?.assignmentId || null}
              onSelect={setSelectedNode}
              searchQuery={searchQuery}
              t={t}
              depth={0}
            />
          </div>
        </CardContent>
      </Card>

      {data.reportingLine.length > 0 && (
        <Card>
          <CardContent>
            <h3 className="text-md font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <ArrowUp className="h-4 w-4 text-blue-600" />
              {t('core.reportingLineUp')}
            </h3>
            <div className="space-y-2">
              {data.reportingLine.map((item, idx) => (
                <div key={idx} className="flex items-center gap-3 text-sm">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">
                    {item.level}
                  </span>
                  <div className="flex-1">
                    <span className="font-medium">{item.supervisor?.name || '-'}</span>
                    <span className="text-gray-400 mx-2">|</span>
                    <span className="text-gray-500">{item.jobTitle?.name || '-'}</span>
                    <span className="text-gray-400 mx-2">|</span>
                    <span className="text-gray-500">{item.department?.name || '-'}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {selectedNode && (
        <Card>
          <CardContent>
            <h3 className="text-md font-semibold text-gray-900 mb-3">{t('core.assignmentDetails')}</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-xs text-gray-500">{t('core.personnel')}</p>
                <p className="font-medium">{selectedNode.person?.name || '-'}</p>
                <p className="text-xs text-gray-400">{selectedNode.person?.code}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">{t('core.jobTitle')}</p>
                <p className="font-medium">{selectedNode.jobTitle?.name || t('core.notSpecified')}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">{t('core.department')}</p>
                <p className="font-medium">{selectedNode.department?.name || t('core.notSpecified')}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">{t('core.branch')}</p>
                <p className="font-medium">{selectedNode.branch?.name || t('core.notSpecified')}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">{t('core.administration')}</p>
                <p className="font-medium">{selectedNode.administration?.name || t('core.notSpecified')}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">{t('core.assignmentType')}</p>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                  {t(`core.assignmentTypes.${selectedNode.assignmentType}`)}
                </span>
              </div>
              <div>
                <p className="text-xs text-gray-500">{t('core.leadershipLevel')}</p>
                {selectedNode.leadershipLevel && selectedNode.leadershipLevel !== 'NONE' ? (
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${LEADERSHIP_COLORS[selectedNode.leadershipLevel] || 'bg-gray-100 text-gray-600'}`}>
                    {t(`core.leadershipLevels.${selectedNode.leadershipLevel}`)}
                  </span>
                ) : (
                  <p className="font-medium text-gray-400">-</p>
                )}
              </div>
              <div>
                <p className="text-xs text-gray-500">{t('common.status')}</p>
                <StatusBadge status={selectedNode.isActive ? 'ACTIVE' : 'INACTIVE'} />
              </div>
              <div>
                <p className="text-xs text-gray-500">{t('core.effectiveFrom')}</p>
                <p className="font-medium">{formatDate(selectedNode.effectiveFrom)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">{t('core.effectiveTo')}</p>
                <p className="font-medium">{formatDate(selectedNode.effectiveTo)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">{t('core.directReports')}</p>
                <p className="font-medium">{selectedNode.childCount}</p>
              </div>
            </div>
            {onViewHistory && selectedNode.person?.id && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <button
                  onClick={() => onViewHistory(selectedNode.person!.id, selectedNode.assignmentId)}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  {t('core.viewHistory')}
                </button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
