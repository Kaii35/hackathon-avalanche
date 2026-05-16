import { prisma } from '@hack/database';
import { NotFoundError, type SessionUser, type UpdateProfileDto } from '@hack/shared';
import { authService } from './auth.service';

export const userService = {
  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<SessionUser> {
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { firstName: dto.firstName, lastName: dto.lastName },
      select: { id: true },
    });
    if (!updated) throw new NotFoundError('Usuario no encontrado');
    const user = await authService.session(userId);
    if (!user) throw new NotFoundError('Usuario no encontrado');
    return user;
  },
};
