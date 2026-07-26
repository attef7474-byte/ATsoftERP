import { Injectable } from '@nestjs/common';
import { NotificationsService } from '../../../notifications/notifications.service';

@Injectable()
export class MaintenanceNotificationService {
  constructor(private notificationsService: NotificationsService) {}

  async notifyRequestCreated(request: any) {
    if (request.requestedBy) {
      await this.notificationsService.dispatch({
        userId: request.assignedToId,
        title: 'New maintenance request assigned',
        message: `Request ${request.requestNumber}: ${request.title}`,
        type: 'INFO',
        link: `/admin/maintenance/requests/${request.id}`,
      });
    }
  }

  async notifyRequestStarted(request: any) {
    if (request.requestedById) {
      await this.notificationsService.dispatch({
        userId: request.requestedById,
        title: 'Maintenance request started',
        message: `Work on ${request.requestNumber} has started`,
        type: 'INFO',
        link: `/admin/maintenance/requests/${request.id}`,
      });
    }
  }

  async notifyRequestCompleted(request: any) {
    if (request.requestedById) {
      await this.notificationsService.dispatch({
        userId: request.requestedById,
        title: 'Maintenance request completed',
        message: `Request ${request.requestNumber} has been completed`,
        type: 'SUCCESS',
        link: `/admin/maintenance/requests/${request.id}`,
      });
    }
  }

  async notifyRequestClosed(request: any) {
    if (request.requestedById) {
      await this.notificationsService.dispatch({
        userId: request.requestedById,
        title: 'Maintenance request closed',
        message: `Request ${request.requestNumber} has been closed`,
        type: 'SUCCESS',
        link: `/admin/maintenance/requests/${request.id}`,
      });
    }
  }

  async notifyRequestAssigned(request: any, assignedUserId: string) {
    await this.notificationsService.dispatch({
      userId: assignedUserId,
      title: 'Maintenance request assigned',
      message: `You have been assigned to ${request.requestNumber}`,
      type: 'INFO',
      link: `/admin/maintenance/requests/${request.id}`,
    });
  }

  async notifyPartRequested(part: any, request: any) {
    if (request.requestedById) {
      await this.notificationsService.dispatch({
        userId: request.requestedById,
        title: 'Spare part requested',
        message: `Part has been requested for ${request.requestNumber}`,
        type: 'INFO',
        link: `/admin/maintenance/requests/${request.id}`,
      });
    }
  }

  async notifyPartApproved(part: any, request: any, approvedById: string) {
    await this.notificationsService.dispatch({
      userId: part.requestedByUserId || request.requestedById,
      title: 'Spare part approved',
      message: `Part ${part.sparePart?.name || ''} has been approved for ${request.requestNumber}`,
      type: 'SUCCESS',
      link: `/admin/maintenance/requests/${request.id}`,
    });
  }

  async notifyPartRejected(part: any, request: any, rejectedById: string) {
    await this.notificationsService.dispatch({
      userId: part.requestedByUserId || request.requestedById,
      title: 'Spare part rejected',
      message: `Part ${part.sparePart?.name || ''} was rejected for ${request.requestNumber}`,
      type: 'WARNING',
      link: `/admin/maintenance/requests/${request.id}`,
    });
  }

  async notifyPartReserved(part: any, request: any) {
    await this.notificationsService.dispatch({
      userId: part.requestedByUserId || request.requestedById,
      title: 'Spare part reserved',
      message: `Part ${part.sparePart?.name || ''} has been reserved for ${request.requestNumber}`,
      type: 'INFO',
      link: `/admin/maintenance/requests/${request.id}`,
    });
  }

  async notifyPartUsed(part: any, request: any) {
    await this.notificationsService.dispatch({
      userId: part.requestedByUserId || request.requestedById,
      title: 'Spare part used',
      message: `Part ${part.sparePart?.name || ''} has been used for ${request.requestNumber}`,
      type: 'SUCCESS',
      link: `/admin/maintenance/requests/${request.id}`,
    });
  }

  async notifySlaOverdue(request: any) {
    const recipients = [request.assignedToId, request.requestedById].filter(Boolean);
    for (const userId of recipients) {
      await this.notificationsService.dispatch({
        userId,
        title: 'SLA overdue',
        message: `Request ${request.requestNumber} is overdue`,
        type: 'WARNING',
        link: `/admin/maintenance/requests/${request.id}`,
      });
    }
  }

  async notifySlaEscalated(request: any, level: string) {
    const recipients = [request.assignedToId, request.requestedById].filter(Boolean);
    for (const userId of recipients) {
      await this.notificationsService.dispatch({
        userId,
        title: `SLA escalation level ${level}`,
        message: `Request ${request.requestNumber} has been escalated to level ${level}`,
        type: 'WARNING',
        link: `/admin/maintenance/requests/${request.id}`,
      });
    }
  }
}
