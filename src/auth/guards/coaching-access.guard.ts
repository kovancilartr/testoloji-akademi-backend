import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';

@Injectable()
export class CoachingAccessGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return false;
    }

    // Admins always have access
    if (user.role === Role.ADMIN) {
      return true;
    }

    // For teachers, check hasCoachingAccess permission
    if (user.role === Role.TEACHER) {
      if (!user.hasCoachingAccess) {
        throw new ForbiddenException(
          'Bu alana erişim yetkiniz bulunmamaktadır. (Koçluk Yetkisi Gerekli)',
        );
      }
      return true;
    }

    if (user.role === Role.STUDENT) {
      return true;
    }

    return false;
  }
}
