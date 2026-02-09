import { PrismaClient, Role, SubscriptionTier } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    const password = await bcrypt.hash('123456', 10);

    // Admin
    const admin = await prisma.user.upsert({
        where: { email: 'admin@mail.com' },
        update: {},
        create: {
            email: 'admin@mail.com',
            name: 'Sistem Yöneticisi',
            password,
            role: Role.ADMIN,
            tier: SubscriptionTier.ALTIN,
            isActive: true,
            passwordChangeRequired: false,
        },
    });

    // Öğretmen
    const teacher = await prisma.user.upsert({
        where: { email: 'teacher@mail.com' },
        update: {},
        create: {
            email: 'teacher@mail.com',
            name: 'Zeynep Öğretmen',
            password,
            role: Role.TEACHER,
            tier: SubscriptionTier.GUMUS,
            isActive: true,
            passwordChangeRequired: false,
        },
    });

    // Öğrenci 1
    const studentUser1 = await prisma.user.upsert({
        where: { email: 'student1@mail.com' },
        update: {},
        create: {
            email: 'student1@mail.com',
            name: 'Ali Öğrenci',
            password,
            role: Role.STUDENT,
            tier: SubscriptionTier.BRONZ,
            isActive: true,
            passwordChangeRequired: true, // Test için true kalsın, zorunlu değiştirsin
        },
    });

    // Student profilini kontrol et
    const existingStudent1 = await prisma.student.findUnique({
        where: { userId: studentUser1.id }
    });

    if (!existingStudent1) {
        await prisma.student.create({
            data: {
                userId: studentUser1.id,
                teacherId: teacher.id,
                name: 'Ali Öğrenci',
                gradeLevel: '12. Sınıf',
                email: 'student1@mail.com',
            },
        });
    }

    // Öğrenci 2
    const studentUser2 = await prisma.user.upsert({
        where: { email: 'student2@mail.com' },
        update: {},
        create: {
            email: 'student2@mail.com',
            name: 'Ayşe Öğrenci',
            password,
            role: Role.STUDENT,
            tier: SubscriptionTier.BRONZ,
            isActive: true,
            passwordChangeRequired: false,
        },
    });

    // Student profilini kontrol et
    const existingStudent2 = await prisma.student.findUnique({
        where: { userId: studentUser2.id }
    });

    if (!existingStudent2) {
        await prisma.student.create({
            data: {
                userId: studentUser2.id,
                teacherId: teacher.id,
                name: 'Ayşe Öğrenci',
                gradeLevel: '11. Sınıf',
                email: 'student2@mail.com',
            },
        });
    }

    console.log({ admin, teacher, studentUser1, studentUser2 });
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
