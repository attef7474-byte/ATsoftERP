'use client';
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { api } from '../../../../lib/api';
import { safeString } from '../../../../lib/form-utils';
import { useCrudList } from '../../../../hooks/useCrudList';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { useAuth } from '@/lib/auth-context';
import { Button, Input, Modal, Pagination, LoadingState } from '../../../../components/admin/ui';
import { GridColumn, GridAction } from '../../../../components/admin/admin-data-grid';
import {
  EntityWorkspaceLayout,
  EntityPageHeader,
  EntityDataTable,
  EntityEmptyState,
} from '../../../../components/entity';
import {
  useRegisterAdminActions,
  useStableHandlers,
  ActionAddIcon,
  ActionEditIcon,
  ActionRefreshIcon,
} from '../../../../components/admin/admin-action-bar';
import {
  F9Lookup,
  branchAdapter,
  departmentAdapter,
  jobTitleAdapter,
  administrationAdapter,
} from '../../../../components/f9';
import { useApiErrorHandler } from '../../../../components/admin/error-handler';
import { adaptFieldErrorsToMap, focusFirstInvalidField } from '../../../../lib/form-validation';

/**
 * UNIFIED GROUP 1 WORKSPACE.
 *
 * "Employees, Users & Maintenance Personnel" is the single human-registration entry point.
 * Every write goes through the canonical orchestration endpoint
 * `/api/v1/person-registrations` (POST create, PATCH update), which writes the
 * OperationalPerson, its OperationalPersonAssignment and the optional User /
 * MaintenancePersonnel in one transaction. The page never issues the three independent
 * legacy creates (`/employees`, `/users`, `/maintenance/personnel`), so an operator cannot
 * bypass the orchestration. The specialized pages remain for login/account administration,
 * role management, login history and maintenance-personnel detail/history.
 */

interface PersonAssignmentView {
  id: string;
  branch?: { id: string; name: string } | null;
  administration?: { id: string; name: string } | null;
  department?: { id: string; name: string } | null;
  jobTitle?: { id: string; name: string } | null;
  assignmentType?: string;
  status?: string;
}

interface PersonLoginView {
  id: string;
  email: string;
  status: string;
  roleIds?: string[];
}

interface PersonMaintenanceView {
  id: string;
  role: string;
  specialty: string | null;
  dailyCapacityMinutes?: number;
  isActive: boolean;
}

interface PersonRegistrationRow {
  id: string;
  code: string;
  name: string;
  category: string;
  phone: string | null;
  email: string | null;
  notes?: string | null;
  isActive: boolean;
  currentAssignment?: PersonAssignmentView | null;
  assignments?: PersonAssignmentView[];
  login?: PersonLoginView | null;
  maintenanceCapability?: PersonMaintenanceView | null;
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface UnifiedForm {
  code: string;
  name: string;
  category: 'OPERATIONAL' | 'MAINTENANCE';
  phone: string;
  email: string;
  notes: string;
  isActive: boolean;

  branchId: string;
  administrationId: string;
  departmentId: string;
  jobTitleId: string;
  assignmentType: 'PRIMARY' | 'SECONDARY' | 'TEMPORARY' | 'ACTING';
  effectiveFrom: string;
  assignmentNotes: string;

  enableMaintenance: boolean;
  maintenanceRole: string;
  maintenanceSpecialty: string;
  dailyCapacityMinutes: number;
  maintenanceIsActive: boolean;

  enableLogin: boolean;
  loginEmail: string;
  loginPassword: string;
  loginName: string;
  loginPhone: string;
  roleIds: string[];
}

const EMPLOYEE_CATEGORIES = ['OPERATIONAL', 'MAINTENANCE'];
const ASSIGNMENT_TYPES = ['PRIMARY', 'SECONDARY', 'TEMPORARY', 'ACTING'];

const EMPTY_FORM: UnifiedForm = {
  code: '',
  name: '',
  category: 'MAINTENANCE',
  phone: '',
  email: '',
  notes: '',
  isActive: true,
  branchId: '',
  administrationId: '',
  departmentId: '',
  jobTitleId: '',
  assignmentType: 'PRIMARY',
  effectiveFrom: '',
  assignmentNotes: '',
  enableMaintenance: false,
  maintenanceRole: '',
  maintenanceSpecialty: '',
  dailyCapacityMinutes: 480,
  maintenanceIsActive: true,
  enableLogin: false,
  loginEmail: '',
  loginPassword: '',
  loginName: '',
  loginPhone: '',
  roleIds: [],
};

const INITIAL_META: PaginationMeta = { page: 1, limit: 10, total: 0, totalPages: 0 };

const personIcon = (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

function StatusBadge({ active, label }: { active: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium ${
        active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
      }`}
    >
      {label}
    </span>
  );
}

export default function UnifiedPersonsPage() {
  const { t, dir } = useTranslation();
  const { showToast } = useToast();
  const handleApiError = useApiErrorHandler();
  const { permissions, isSuperAdmin } = useAuth();

  // Group 1 permission segmentation. Each control family is gated by its OWN domain; a
  // single broad "canEdit" flag would let personnel administration imply access control.
  const can = useCallback(
    (permission: string) => isSuperAdmin || Boolean(permissions?.permissions.includes(permission)),
    [isSuperAdmin, permissions],
  );
  const canCreatePersonnel = can('operational-person:create');
  const canUpdatePersonnel = can('operational-person:update');
  const canCreateUser = can('user:create');
  const canUpdateUser = can('user:update');
  const canCreateMaintenance = can('maintenance-personnel:create');
  const canUpdateMaintenance = can('maintenance-personnel:update');

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [sortColumn, setSortColumn] = useState('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [showFilters, setShowFilters] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [roles, setRoles] = useState<Array<{ id: string; name: string }>>([]);

  const {
    data,
    meta,
    loading,
    error,
    form,
    setForm,
    modalOpen,
    editItem,
    detailLoading,
    saving,
    refresh: fetchData,
    openCreate,
    openEdit,
    closeFormModal,
    handleSave,
  } = useCrudList<PersonRegistrationRow, UnifiedForm, Record<string, unknown>, PaginationMeta, [page?: number]>({
    initialForm: EMPTY_FORM,
    initialMeta: INITIAL_META,
    initialListArgs: [1],
    listRequest: (page = 1) => {
      const params: Record<string, string | number | undefined> = { page, limit: 10 };
      if (search) params.search = search;
      if (sortColumn) {
        params.sortBy = sortColumn;
        params.sortOrder = sortDirection;
      }
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params[key] = value;
      });
      return api.get('/person-registrations', { params });
    },
    detailRequest: (id) => api.get(`/person-registrations/${id}`),
    createRequest: (payload) => api.post('/person-registrations', payload),
    updateRequest: (id, payload) => api.patch(`/person-registrations/${id}`, payload),
    mapRecordToForm: (detail) => {
      const assignment = detail.currentAssignment || detail.assignments?.[0] || null;
const maintenance = detail.maintenanceCapability || null;
    const user = detail.login || null;
      return {
        code: safeString(detail.code),
        name: safeString(detail.name),
        category: (detail.category as UnifiedForm['category']) || 'MAINTENANCE',
        phone: safeString(detail.phone),
        email: safeString(detail.email),
        notes: safeString(detail.notes),
        isActive: detail.isActive !== false,
        branchId: safeString(assignment?.branch?.id),
        administrationId: safeString(assignment?.administration?.id),
        departmentId: safeString(assignment?.department?.id),
        jobTitleId: safeString(assignment?.jobTitle?.id),
        assignmentType: (assignment?.assignmentType as UnifiedForm['assignmentType']) || 'PRIMARY',
        effectiveFrom: '',
        assignmentNotes: '',
        enableMaintenance: Boolean(maintenance),
        maintenanceRole: safeString(maintenance?.role),
        maintenanceSpecialty: safeString(maintenance?.specialty),
        dailyCapacityMinutes: maintenance?.dailyCapacityMinutes ?? 480,
        maintenanceIsActive: maintenance?.isActive !== false,
        enableLogin: Boolean(user),
        loginEmail: safeString(user?.email),
        loginPassword: '',
        loginName: safeString(detail.name),
        loginPhone: safeString(detail.phone),
        // Role selection is never prefilled: it is only sent when the operator explicitly
        // changes it, so an unrelated edit can never silently reset grant state.
        roleIds: [],
      };
    },
    mapFormToPayload: (values) => {
      const payload: Record<string, unknown> = {
        name: values.name,
        category: values.category,
        phone: values.phone || null,
        email: values.email || null,
        notes: values.notes || null,
        isActive: values.isActive,
        placement: {
          departmentId: values.departmentId,
          branchId: values.branchId || undefined,
          administrationId: values.administrationId || undefined,
          jobTitleId: values.jobTitleId || undefined,
          assignmentType: values.assignmentType,
          effectiveFrom: values.effectiveFrom || undefined,
          notes: values.assignmentNotes || undefined,
        },
      };
      if (values.code) payload.code = values.code;
      if (values.enableLogin) {
        // Only the contract fields are sent; credential and authentication metadata are
        // never part of the unified payload.
        payload.login = {
          email: values.loginEmail,
          ...(values.loginPassword ? { password: values.loginPassword } : {}),
          name: values.loginName || values.name,
          phone: values.loginPhone || values.phone || null,
          roleIds: values.roleIds,
        };
      }
      if (values.enableMaintenance) {
        payload.maintenance = {
          role: values.maintenanceRole,
          specialty: values.maintenanceSpecialty || null,
          dailyCapacityMinutes: values.dailyCapacityMinutes,
          isActive: values.maintenanceIsActive,
        };
      }
      return payload;
    },
    validate: (values) => {
      const fieldErrors: Record<string, string> = {};
      if (!values.name?.trim()) fieldErrors.name = t('validation.requiredField');
      if (!values.departmentId) fieldErrors.departmentId = t('validation.requiredField');
      if (values.enableMaintenance && !values.maintenanceRole?.trim()) {
        fieldErrors.maintenanceRole = t('validation.requiredField');
      }
      if (values.enableLogin && !values.loginEmail?.trim()) {
        fieldErrors.loginEmail = t('validation.requiredField');
      }
      return Object.keys(fieldErrors).length > 0 ? { fieldErrors } : null;
    },
    onError: (message) => {
      setValidationErrors({ form: message });
    },
    onFieldErrors: (errors) => {
      setValidationErrors(adaptFieldErrorsToMap(errors));
      focusFirstInvalidField(errors);
    },
    onSuccess: (operation) => {
      const message =
        operation === 'create' ? t('common.successCreated') : t('common.successUpdated');
      showToast(message, 'success');
      setValidationErrors({});
    },
  });

  useEffect(() => {
    let cancelled = false;
    api
      .get('/roles', { params: { limit: 200 } })
      .then((res: any) => {
        if (cancelled) return;
        const list = res?.data?.data || res?.data || [];
        setRoles(Array.isArray(list) ? list.map((r: any) => ({ id: r.id, name: r.name })) : []);
      })
      .catch(() => {
        // Role list is supplemental; failure must not block person administration.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const paginationMeta = meta ?? INITIAL_META;
  const selectedRecord = useMemo(() => data.find((d) => d.id === selectedId), [data, selectedId]);

  const { exec } = useStableHandlers({
    new: () => openCreate(),
    edit: () => selectedRecord && openEdit(selectedRecord),
    refresh: () => fetchData(paginationMeta.page),
  });

  useRegisterAdminActions([
    { id: 'new', labelKey: 'common.create', icon: <ActionAddIcon />, onClick: () => exec('new'), enabled: canCreatePersonnel },
    { id: 'edit', labelKey: 'common.edit', icon: <ActionEditIcon />, onClick: () => exec('edit'), enabled: !!selectedId && canUpdatePersonnel },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
  ]);

  const baseColumns: GridColumn<PersonRegistrationRow>[] = [
    { key: 'code', header: t('common.code'), sortable: true },
    { key: 'name', header: t('common.name'), sortable: true },
    {
      key: 'department',
      header: t('core.department'),
      render: (d) => safeString(d.currentAssignment?.department?.name) || '-',
    },
    {
      key: 'jobTitle',
      header: t('core.jobTitle'),
      render: (d) => safeString(d.currentAssignment?.jobTitle?.name) || '-',
    },
    {
      key: 'systemAccess',
      header: t('access.systemAccess'),
      render: (d) =>
        d.login
          ? d.login.status === 'ACTIVE'
            ? t('common.active')
            : `${t('common.active')} (${t('common.inactive')})`
          : t('common.no'),
    },
    {
      key: 'maintenanceCapability',
      header: t('maintenance.maintenancePersonnel'),
      render: (d) =>
        d.maintenanceCapability
          ? d.maintenanceCapability.isActive
            ? t('common.active')
            : `${t('common.active')} (${t('common.inactive')})`
          : t('common.no'),
    },
    {
      key: 'isActive',
      header: t('common.status'),
      render: (d) => <StatusBadge active={d.isActive} label={d.isActive ? t('common.active') : t('common.inactive')} />,
    },
  ];

  const gridActions: GridAction<PersonRegistrationRow>[] = [
    {
      label: t('grid.edit'),
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      ),
      onClick: (d) => openEdit(d),
      enabled: () => canUpdatePersonnel,
    },
  ];

  const handleSort = useCallback((col: string, direction: 'asc' | 'desc') => {
    setSortColumn(col);
    setSortDirection(direction);
  }, []);

  const handleFilter = useCallback((col: string, value: string) => {
    setFilters((prev) => ({ ...prev, [col]: value }));
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters({});
    setSearch('');
  }, []);

  const maintenanceToggleDisabled = !canCreateMaintenance && !canUpdateMaintenance && !editItem;
  const loginToggleDisabled = !canCreateUser && !canUpdateUser && !editItem;

  return (
    <EntityWorkspaceLayout drawerOpen={false}>
      <EntityPageHeader title={t('navigation.persons')} icon={personIcon} />
      {error && (
        <div className="text-center py-12">
          <p className="text-red-500 mb-4">{error}</p>
        </div>
      )}
      {!error && loading && data.length === 0 && <div className="py-12" />}
      {!error && !loading && data.length === 0 && <EntityEmptyState title={t('common.noData')} />}
      {(!error || !loading) && data.length > 0 && (
        <EntityDataTable
          columns={baseColumns}
          data={data}
          keyExtractor={(item) => item.id}
          selectedKey={selectedId}
          onRowClick={(item) => setSelectedId(item.id)}
          loading={loading}
          emptyMessage={t('common.noData')}
          loadingMessage={t('common.loading')}
          error={error || undefined}
          actions={gridActions}
          sortColumn={sortColumn}
          sortDirection={sortDirection}
          onSort={handleSort}
          filters={filters}
          onFilter={handleFilter}
          onClearFilters={handleClearFilters}
          showFilters={showFilters}
          onToggleFilters={() => setShowFilters(!showFilters)}
          dir={dir}
          globalSearch={search}
          onGlobalSearch={(v) => setSearch(v)}
          searchPlaceholder={t('grid.searchPlaceholder')}
          onRefresh={() => fetchData(paginationMeta.page)}
          refreshLoading={loading}
        />
      )}
      {data.length > 0 && (
        <div className="flex justify-end p-4">
          <Pagination page={paginationMeta.page} totalPages={paginationMeta.totalPages} total={paginationMeta.total} onPageChange={fetchData} />
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => {
          closeFormModal();
          setValidationErrors({});
        }}
        title={editItem ? t('common.edit') : t('common.create')}
        size="xl"
      >
        {detailLoading ? (
          <LoadingState />
        ) : (
          <div className="space-y-6 max-h-[70vh] overflow-y-auto">
            {validationErrors.form && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {validationErrors.form}
              </div>
            )}

            {/* A. PERSONAL INFORMATION */}
            <section className="space-y-4" data-section="personal-information">
              <h3 className="text-lg font-medium border-b pb-2">{t('core.personalInformation')}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label={t('common.code')}
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  error={validationErrors.code}
                />
                <Input
                  label={t('common.name')}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  error={validationErrors.name}
                  required
                />
                <div>
                  <label className="block text-sm font-medium mb-1">{t('core.personCategory')}</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value as UnifiedForm['category'] })}
                    className="w-full border rounded px-3 py-2 text-sm"
                  >
                    {EMPLOYEE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {t(`core.employeeCategories.${c}`)}
                      </option>
                    ))}
                  </select>
                </div>
                <Input
                  label={t('common.phone')}
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  error={validationErrors.phone}
                />
                <Input
                  label={t('common.email')}
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  error={validationErrors.email}
                />
                <Input
                  label={t('common.notes')}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  error={validationErrors.notes}
                />
              </div>
            </section>

            {/* B. ORGANIZATION / ASSIGNMENT */}
            <section className="space-y-4" data-section="organization-assignment">
              <h3 className="text-lg font-medium border-b pb-2">{t('core.organizationAssignment')}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <F9Lookup
                  label={t('core.branch')}
                  value={form.branchId}
                  onChange={(v) => setForm({ ...form, branchId: v })}
                  adapter={branchAdapter}
                  error={validationErrors.branchId}
                />
                <F9Lookup
                  label={t('core.administration')}
                  value={form.administrationId}
                  onChange={(v) => setForm({ ...form, administrationId: v })}
                  adapter={administrationAdapter}
                  error={validationErrors.administrationId}
                />
                <F9Lookup
                  label={t('core.department')}
                  value={form.departmentId}
                  onChange={(v) => setForm({ ...form, departmentId: v })}
                  adapter={departmentAdapter}
                  error={validationErrors.departmentId}
                />
                <F9Lookup
                  label={t('core.jobTitle')}
                  value={form.jobTitleId}
                  onChange={(v) => setForm({ ...form, jobTitleId: v })}
                  adapter={jobTitleAdapter}
                  error={validationErrors.jobTitleId}
                />
                <div>
                  <label className="block text-sm font-medium mb-1">{t('core.assignmentType')}</label>
                  <select
                    value={form.assignmentType}
                    onChange={(e) => setForm({ ...form, assignmentType: e.target.value as UnifiedForm['assignmentType'] })}
                    className="w-full border rounded px-3 py-2 text-sm"
                  >
                    {ASSIGNMENT_TYPES.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </div>
                <Input
                  label={t('core.effectiveFrom')}
                  type="date"
                  value={form.effectiveFrom}
                  onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })}
                  error={validationErrors.effectiveFrom}
                />
                <Input
                  label={t('core.assignmentNotes')}
                  value={form.assignmentNotes}
                  onChange={(e) => setForm({ ...form, assignmentNotes: e.target.value })}
                  error={validationErrors.assignmentNotes}
                />
              </div>
            </section>

            {/* C. MAINTENANCE CAPABILITY */}
            <section className="space-y-4" data-section="maintenance-capability">
              <h3 className="text-lg font-medium border-b pb-2">{t('core.maintenanceCapability')}</h3>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.enableMaintenance}
                  disabled={maintenanceToggleDisabled}
                  onChange={(e) => setForm({ ...form, enableMaintenance: e.target.checked })}
                />
                {t('core.enableMaintenanceCapability')}
              </label>
              {form.enableMaintenance && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label={t('maintenance.role')}
                    value={form.maintenanceRole}
                    onChange={(e) => setForm({ ...form, maintenanceRole: e.target.value })}
                    error={validationErrors.maintenanceRole}
                  />
                  <Input
                    label={t('maintenance.specialty')}
                    value={form.maintenanceSpecialty}
                    onChange={(e) => setForm({ ...form, maintenanceSpecialty: e.target.value })}
                    error={validationErrors.maintenanceSpecialty}
                  />
                  <Input
                    label={t('core.dailyCapacityMinutes')}
                    type="number"
                    value={String(form.dailyCapacityMinutes)}
                    onChange={(e) => setForm({ ...form, dailyCapacityMinutes: parseInt(e.target.value, 10) || 0 })}
                    error={validationErrors.dailyCapacityMinutes}
                  />
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.maintenanceIsActive}
                      onChange={(e) => setForm({ ...form, maintenanceIsActive: e.target.checked })}
                    />
                    {t('common.active')}
                  </label>
                </div>
              )}
            </section>

            {/* D. SYSTEM LOGIN */}
            <section className="space-y-4" data-section="system-login">
              <h3 className="text-lg font-medium border-b pb-2">{t('core.systemLogin')}</h3>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.enableLogin}
                  disabled={loginToggleDisabled}
                  onChange={(e) => setForm({ ...form, enableLogin: e.target.checked })}
                />
                {t('core.enableSystemAccess')}
              </label>
              {form.enableLogin && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      label={t('common.email')}
                      type="email"
                      value={form.loginEmail}
                      onChange={(e) => setForm({ ...form, loginEmail: e.target.value })}
                      error={validationErrors.loginEmail}
                    />
                    {!editItem && (
                      <Input
                        label={t('access.password')}
                        type="password"
                        value={form.loginPassword}
                        onChange={(e) => setForm({ ...form, loginPassword: e.target.value })}
                        error={validationErrors.loginPassword}
                      />
                    )}
                  </div>
                  {/* E. ROLES / ACCESS — only rendered when the caller can grant roles. */}
                  {canUpdateUser && (
                    <div data-section="roles-access">
                      <label className="block text-sm font-medium mb-1">{t('access.roles')}</label>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 border rounded p-3 max-h-40 overflow-y-auto">
                        {roles.map((role) => (
                          <label key={role.id} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={form.roleIds.includes(role.id)}
                              onChange={(e) => {
                                setForm({
                                  ...form,
                                  roleIds: e.target.checked
                                    ? [...form.roleIds, role.id]
                                    : form.roleIds.filter((id) => id !== role.id),
                                });
                              }}
                            />
                            {role.name}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </section>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="secondary"
                onClick={() => {
                  closeFormModal();
                  setValidationErrors({});
                }}
              >
                {t('actions.cancel')}
              </Button>
              <Button onClick={handleSave} loading={saving}>
                {t('actions.save')}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </EntityWorkspaceLayout>
  );
}