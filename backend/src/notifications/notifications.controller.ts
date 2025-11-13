import { 
  Controller, 
  Get, 
  Patch, 
  Param, 
  Query, 
  Delete, 
  Body, 
  UseGuards 
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  // 📅 Get all upcoming session notifications for a user
  @Get('upcoming-sessions/:userId')
  async getUpcomingSessionNotifications(
    @Param('userId') userId: string,
    @Query('userType') userType: 'tutor' | 'tutee',
  ) {
    try {
      const notifications = await this.notificationsService.getUpcomingSessionNotifications(
        userId,
        userType,
      );
      return {
        success: true,
        data: notifications,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to fetch notifications',
        error: error.message,
      };
    }
  }

  // ✅ Mark a single notification as read
  @Patch(':notificationId/read')
  async markNotificationAsRead(@Param('notificationId') notificationId: string) {
    try {
      const id = parseInt(notificationId, 10);
      if (isNaN(id)) throw new Error('Invalid notification ID');

      await this.notificationsService.markNotificationAsRead(id);
      return {
        success: true,
        message: 'Notification marked as read',
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to mark notification as read',
        error: error.message,
      };
    }
  }

  // ✅ Mark all notifications as read for a specific user
  @Patch('read-all/:userId')
  async markAllNotificationsAsRead(@Param('userId') userId: string) {
    try {
      await this.notificationsService.markAllAsRead(userId);
      return {
        success: true,
        message: 'All notifications marked as read',
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to mark all notifications as read',
        error: error.message,
      };
    }
  }

  // 🗑️ Delete a notification
  @Delete(':notificationId')
  async deleteNotification(@Param('notificationId') notificationId: string) {
    try {
      const id = parseInt(notificationId, 10);
      if (isNaN(id)) throw new Error('Invalid notification ID');

      await this.notificationsService.deleteNotification(id);
      return {
        success: true,
        message: 'Notification deleted successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to delete notification',
        error: error.message,
      };
    }
  }
}
