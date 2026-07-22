'use client';

import { Dispatch, SetStateAction, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  assertRecordId,
  safeErrorMessage,
  unwrapApiData,
  unwrapApiList,
  UnwrappedApiList,
} from '../lib/form-utils';

export type CrudOperation = 'list' | 'detail' | 'create' | 'update' | 'delete';

export interface CrudPayloadContext<TRecord> {
  mode: 'create' | 'edit';
  record: TRecord | null;
}

export interface UseCrudListOptions<
  TRecord extends object,
  TForm extends object,
  TPayload extends object = Partial<TForm>,
  TMeta = Record<string, unknown>,
  TListArgs extends unknown[] = [],
> {
  initialForm: TForm | (() => TForm);
  initialMeta?: TMeta;
  initialListArgs?: TListArgs;
  autoLoad?: boolean;
  listRequest: (...args: TListArgs) => Promise<unknown>;
  detailRequest: (id: string) => Promise<unknown>;
  createRequest: (payload: TPayload) => Promise<unknown>;
  updateRequest: (id: string, payload: TPayload) => Promise<unknown>;
  deleteRequest?: (id: string) => Promise<unknown>;
  mapListResponse?: (response: unknown) => UnwrappedApiList<TRecord, TMeta>;
  mapRecordToForm: (record: TRecord) => TForm;
  mapFormToPayload: (form: TForm, context: CrudPayloadContext<TRecord>) => TPayload;
  getRecordId?: (record: TRecord) => string;
  validate?: (form: TForm, context: CrudPayloadContext<TRecord>) => string | null | undefined;
  errorMessage?: (operation: CrudOperation) => string;
  onError?: (message: string, operation: CrudOperation, error: unknown) => void;
  onSuccess?: (operation: Exclude<CrudOperation, 'list' | 'detail'>, result: unknown) => void;
}

function makeInitialForm<TForm extends object>(
  initialForm: TForm | (() => TForm),
): TForm {
  return typeof initialForm === 'function'
    ? (initialForm as () => TForm)()
    : { ...initialForm };
}

export function useCrudList<
  TRecord extends object,
  TForm extends object,
  TPayload extends object = Partial<TForm>,
  TMeta = Record<string, unknown>,
  TListArgs extends unknown[] = [],
>(options: UseCrudListOptions<TRecord, TForm, TPayload, TMeta, TListArgs>) {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const mountedRef = useRef(true);
  const listRequestRef = useRef(0);
  const detailRequestRef = useRef(0);
  const initialListArgsRef = useRef<TListArgs>((options.initialListArgs ?? []) as TListArgs);
  const lastListArgsRef = useRef<TListArgs>(initialListArgsRef.current);

  const [data, setData] = useState<TRecord[]>([]);
  const [meta, setMeta] = useState<TMeta | undefined>(options.initialMeta);
  const [total, setTotal] = useState<number | undefined>();
  const [loading, setLoading] = useState(options.autoLoad !== false);
  const [error, setError] = useState('');

  const [form, setForm] = useState<TForm>(() => makeInitialForm(options.initialForm));
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [editItem, setEditItem] = useState<TRecord | null>(null);
  const [detailRecord, setDetailRecord] = useState<TRecord | null>(null);
  const [deleteItem, setDeleteItem] = useState<TRecord | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailReady, setDetailReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const getFallback = useCallback((operation: CrudOperation) => {
    return optionsRef.current.errorMessage?.(operation) ?? 'The requested operation could not be completed.';
  }, []);

  const reportError = useCallback((operation: CrudOperation, thrown: unknown) => {
    const message = safeErrorMessage(thrown, getFallback(operation));
    optionsRef.current.onError?.(message, operation, thrown);
    return message;
  }, [getFallback]);

  const refresh = useCallback(async (...args: TListArgs): Promise<boolean> => {
    const requestId = ++listRequestRef.current;
    const requestArgs = (args.length > 0 ? args : lastListArgsRef.current) as TListArgs;
    lastListArgsRef.current = requestArgs;
    setLoading(true);
    setError('');

    try {
      const response = await optionsRef.current.listRequest(...requestArgs);
      const listResult = optionsRef.current.mapListResponse
        ? optionsRef.current.mapListResponse(response)
        : unwrapApiList<TRecord, TMeta>(response);

      if (mountedRef.current && requestId === listRequestRef.current) {
        setData(listResult.data);
        setMeta(listResult.meta);
        setTotal(listResult.total);
      }
      return true;
    } catch (thrown) {
      if (mountedRef.current && requestId === listRequestRef.current) {
        setError(reportError('list', thrown));
      }
      return false;
    } finally {
      if (mountedRef.current && requestId === listRequestRef.current) setLoading(false);
    }
  }, [reportError]);

  useEffect(() => {
    mountedRef.current = true;
    if (optionsRef.current.autoLoad !== false) void refresh(...initialListArgsRef.current);

    return () => {
      mountedRef.current = false;
      listRequestRef.current += 1;
      detailRequestRef.current += 1;
    };
  }, [refresh]);

  const closeFormModal = useCallback(() => {
    detailRequestRef.current += 1;
    setCreateOpen(false);
    setEditOpen(false);
    setEditItem(null);
    setDetailReady(false);
    setDetailLoading(false);
  }, []);

  const closeView = useCallback(() => {
    detailRequestRef.current += 1;
    setViewOpen(false);
    setDetailRecord(null);
    setDetailLoading(false);
  }, []);

  const openCreate = useCallback(() => {
    detailRequestRef.current += 1;
    setEditOpen(false);
    setViewOpen(false);
    setEditItem(null);
    setDetailRecord(null);
    setDetailReady(true);
    setForm(makeInitialForm(optionsRef.current.initialForm));
    setCreateOpen(true);
  }, []);

  const loadDetail = useCallback(async (row: TRecord, mode: 'edit' | 'view'): Promise<boolean> => {
    let id: string;
    try {
      id = optionsRef.current.getRecordId?.(row) ?? assertRecordId(row);
    } catch (thrown) {
      reportError('detail', thrown);
      return false;
    }

    const requestId = ++detailRequestRef.current;
    setDetailLoading(true);
    setDetailReady(false);
    setDetailRecord(null);

    if (mode === 'edit') {
      setCreateOpen(false);
      setViewOpen(false);
      setEditItem(row);
      setEditOpen(true);
    } else {
      setCreateOpen(false);
      setEditOpen(false);
      setEditItem(null);
      setViewOpen(true);
    }

    try {
      const response = await optionsRef.current.detailRequest(id);
      const detail = unwrapApiData<TRecord>(response);
      if (!detail || typeof detail !== 'object') throw new Error(getFallback('detail'));

      if (mountedRef.current && requestId === detailRequestRef.current) {
        setDetailRecord(detail);
        if (mode === 'edit') {
          setEditItem(detail);
          setForm(optionsRef.current.mapRecordToForm(detail));
        }
        setDetailReady(true);
      }
      return true;
    } catch (thrown) {
      if (mountedRef.current && requestId === detailRequestRef.current) {
        reportError('detail', thrown);
        if (mode === 'edit') {
          setEditOpen(false);
          setEditItem(null);
        } else {
          setViewOpen(false);
        }
      }
      return false;
    } finally {
      if (mountedRef.current && requestId === detailRequestRef.current) setDetailLoading(false);
    }
  }, [getFallback, reportError]);

  const openEdit = useCallback((row: TRecord) => loadDetail(row, 'edit'), [loadDetail]);
  const openView = useCallback((row: TRecord) => loadDetail(row, 'view'), [loadDetail]);

  const requestDelete = useCallback((row: TRecord): boolean => {
    try {
      optionsRef.current.getRecordId?.(row) ?? assertRecordId(row);
      setDeleteItem(row);
      setDeleteConfirmOpen(true);
      return true;
    } catch (thrown) {
      reportError('delete', thrown);
      return false;
    }
  }, [reportError]);

  const cancelDelete = useCallback(() => {
    if (deleting) return;
    setDeleteConfirmOpen(false);
    setDeleteItem(null);
  }, [deleting]);

  const handleSave = useCallback(async (): Promise<boolean> => {
    if (saving || detailLoading) return false;

    const isEdit = editOpen;
    const record = isEdit ? editItem : null;
    if (!createOpen && !isEdit) return false;
    if (isEdit && (!detailReady || !record)) {
      reportError('detail', new Error(getFallback('detail')));
      return false;
    }

    const context: CrudPayloadContext<TRecord> = { mode: isEdit ? 'edit' : 'create', record };
    const validationMessage = optionsRef.current.validate?.(form, context);
    if (validationMessage) {
      optionsRef.current.onError?.(validationMessage, isEdit ? 'update' : 'create', new Error(validationMessage));
      return false;
    }

    setSaving(true);
    const operation: 'create' | 'update' = isEdit ? 'update' : 'create';
    try {
      // Payload mapping is intentionally mandatory. A page must explicitly
      // whitelist editable fields instead of PATCHing a partial list row or a
      // detail object containing relationships/system-managed properties.
      const payload = optionsRef.current.mapFormToPayload(form, context);
      const response = isEdit
        ? await optionsRef.current.updateRequest(
            optionsRef.current.getRecordId?.(record as TRecord) ?? assertRecordId(record),
            payload,
          )
        : await optionsRef.current.createRequest(payload);
      const result = unwrapApiData<unknown>(response);

      if (mountedRef.current) {
        closeFormModal();
        optionsRef.current.onSuccess?.(operation, result);
        await refresh(...lastListArgsRef.current);
      }
      return true;
    } catch (thrown) {
      if (mountedRef.current) reportError(operation, thrown);
      return false;
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  }, [closeFormModal, createOpen, detailLoading, detailReady, editItem, editOpen, form, getFallback, refresh, reportError, saving]);

  const handleDelete = useCallback(async (): Promise<boolean> => {
    if (deleting || !deleteItem || !optionsRef.current.deleteRequest) return false;

    let id: string;
    try {
      id = optionsRef.current.getRecordId?.(deleteItem) ?? assertRecordId(deleteItem);
    } catch (thrown) {
      reportError('delete', thrown);
      return false;
    }

    setDeleting(true);
    try {
      const response = await optionsRef.current.deleteRequest(id);
      const result = unwrapApiData<unknown>(response);
      if (mountedRef.current) {
        setDeleteConfirmOpen(false);
        setDeleteItem(null);
        optionsRef.current.onSuccess?.('delete', result);
        await refresh(...lastListArgsRef.current);
      }
      return true;
    } catch (thrown) {
      if (mountedRef.current) reportError('delete', thrown);
      return false;
    } finally {
      if (mountedRef.current) setDeleting(false);
    }
  }, [deleteItem, deleting, refresh, reportError]);

  const modalOpen = createOpen || editOpen;
  const selectedMode = useMemo<'create' | 'edit' | null>(() => {
    if (createOpen) return 'create';
    if (editOpen) return 'edit';
    return null;
  }, [createOpen, editOpen]);

  return {
    data,
    setData,
    meta,
    total,
    loading,
    error,
    form,
    setForm: setForm as Dispatch<SetStateAction<TForm>>,
    createOpen,
    editOpen,
    viewOpen,
    modalOpen,
    selectedMode,
    deleteConfirmOpen,
    editItem,
    detailRecord,
    deleteItem,
    detailLoading,
    detailReady,
    saving,
    deleting,
    refresh,
    openCreate,
    openEdit,
    openView,
    closeFormModal,
    closeView,
    requestDelete,
    cancelDelete,
    handleSave,
    handleDelete,
  };
}
