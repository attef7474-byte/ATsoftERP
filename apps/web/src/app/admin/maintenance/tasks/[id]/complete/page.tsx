import { notFound, redirect } from 'next/navigation';
import { isReservedDetailRouteId } from '../../../../../../lib/route-guards';

/** Historical bookmarks use the canonical execution workspace. */
export default async function LegacyExecutionRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (isReservedDetailRouteId(id)) notFound();
  redirect('/admin/maintenance/tasks?executionId=' + encodeURIComponent(id) + '&action=complete');
}
