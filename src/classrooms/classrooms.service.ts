import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClassroomDto } from './dto/create-classroom.dto';
import { UpdateClassroomDto } from './dto/update-classroom.dto';

@Injectable()
export class ClassroomsService {
  constructor(private prisma: PrismaService) {}

  async create(teacherId: string, dto: CreateClassroomDto) {
    const { studentIds, ...classroomData } = dto;

    return this.prisma.classroom.create({
      data: {
        ...classroomData,
        teacherId,
        students: studentIds
          ? {
              connect: studentIds.map((id) => ({ id })),
            }
          : undefined,
      },
      include: {
        students: true,
        _count: {
          select: { students: true },
        },
      },
    });
  }

  async findAll(teacherId: string) {
    return this.prisma.classroom.findMany({
      where: { teacherId },
      include: {
        _count: {
          select: { students: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(teacherId: string, id: string) {
    const classroom = await this.prisma.classroom.findFirst({
      where: { id, teacherId },
      include: {
        students: {
          include: {
            user: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!classroom) {
      throw new NotFoundException('Sınıf bulunamadı.');
    }

    return classroom;
  }

  async update(teacherId: string, id: string, dto: UpdateClassroomDto) {
    const { studentIds, ...classroomData } = dto;

    // Verify ownership
    const existing = await this.prisma.classroom.findFirst({
      where: { id, teacherId },
    });

    if (!existing) {
      throw new NotFoundException('Sınıf bulunamadı.');
    }

    return this.prisma.classroom.update({
      where: { id },
      data: {
        ...classroomData,
        students: studentIds
          ? {
              set: studentIds.map((id) => ({ id })),
            }
          : undefined,
      },
      include: {
        students: true,
      },
    });
  }

  async remove(teacherId: string, id: string) {
    const existing = await this.prisma.classroom.findFirst({
      where: { id, teacherId },
    });

    if (!existing) {
      throw new NotFoundException('Sınıf bulunamadı.');
    }

    return this.prisma.classroom.delete({
      where: { id },
    });
  }

  async addStudents(teacherId: string, id: string, studentIds: string[]) {
    const existing = await this.prisma.classroom.findFirst({
      where: { id, teacherId },
    });

    if (!existing) {
      throw new NotFoundException('Sınıf bulunamadı.');
    }

    return this.prisma.classroom.update({
      where: { id },
      data: {
        students: {
          connect: studentIds.map((id) => ({ id })),
        },
      },
      include: {
        students: true,
      },
    });
  }

  async removeStudents(teacherId: string, id: string, studentIds: string[]) {
    const existing = await this.prisma.classroom.findFirst({
      where: { id, teacherId },
    });

    if (!existing) {
      throw new NotFoundException('Sınıf bulunamadı.');
    }

    return this.prisma.classroom.update({
      where: { id },
      data: {
        students: {
          disconnect: studentIds.map((id) => ({ id })),
        },
      },
      include: {
        students: true,
      },
    });
  }
}
