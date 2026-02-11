/**
 * DEBUG: Sistem Genel Durumu
 * 
 * Veritabanındaki ana tabloların (Kullanıcı, Öğrenci, Ödev, Proje) 
 * toplam kayıt sayılarını gösterir. Sistemin genel doluluk oranını
 * hızlıca görmek için kullanılır.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('\n--- 🛡️ SİSTEM GENEL DURUM ÖZETİ ---');

    const [userCount, studentCount, assignmentCount, projectCount, notificationCount] = await Promise.all([
        prisma.user.count(),
        prisma.student.count(),
        prisma.assignment.count(),
        prisma.project.count(),
        prisma.notification.count(),
    ]);

    console.log(`👤 Toplam Kullanıcı: ${userCount}`);
    console.log(`🎓 Toplam Öğrenci:  ${studentCount}`);
    console.log(`📝 Toplam Ödev:     ${assignmentCount}`);
    console.log(`📁 Toplam Proje:    ${projectCount}`);
    console.log(`🔔 Toplam Bildirim: ${notificationCount}`);

    console.log('\n--- 🏫 ROLLERİNE GÖRE KULLANICILAR ---');
    const roles = await prisma.user.groupBy({
        by: ['role'],
        _count: true
    });

    roles.forEach(r => {
        console.log(`${r.role}: ${r._count}`);
    });

    console.log('\n--- 📅 SON KAYIT OLAN 5 KULLANICI ---');
    const recentUsers = await prisma.user.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: { name: true, email: true, role: true, createdAt: true }
    });

    recentUsers.forEach(u => {
        console.log(`[${u.createdAt.toLocaleDateString()}] ${u.name} (${u.email}) - ${u.role}`);
    });
}

main()
    .catch(e => console.error('Hata:', e))
    .finally(async () => {
        await prisma.$disconnect();
    });
