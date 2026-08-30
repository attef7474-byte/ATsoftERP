export interface HistoryPersonSelection {
  opaLookupId: string;
  personId: string | undefined;
}

export interface HistoryPersonItem {
  id: string;
  personnelId: string;
}

export function initHistoryPersonSelection(
  assignmentId: string | undefined,
  personId: string | undefined,
): HistoryPersonSelection {
  return {
    opaLookupId: assignmentId || '',
    personId: personId || undefined,
  };
}

export function selectHistoryPerson(item: HistoryPersonItem): HistoryPersonSelection {
  return {
    opaLookupId: item.id,
    personId: item.personnelId,
  };
}

export function clearHistoryPersonSelection(): HistoryPersonSelection {
  return { opaLookupId: '', personId: undefined };
}

export function handleHistoryPersonChange(
  current: HistoryPersonSelection,
  id: string,
): HistoryPersonSelection {
  if (!id) {
    return clearHistoryPersonSelection();
  }
  return { ...current, opaLookupId: id };
}
