/**
 * DEBUG: Kullanıcı Detayları ve Yetkiler
 * 
 * Sistemdeki kullanıcıların abonelik durumlarını, koçluk erişim yetkilerini
 * ve aktiflik durumlarını listeler. Yetki problemlerini çözmek için kullanılır.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('\n--- 👥 KULLANICI YETKİ VE ABONELİK LİSTESİ ---');

    const users = await prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
            id: true,
            name: true,
            email: true,
            role: true,
            tier: true,
            hasCoachingAccess: true,
            isActive: true,
            subscriptionExpires: true
        }
    });

    users.forEach(u => {
        const coachingStatus = u.hasCoachingAccess ? '✅ VAR' : '❌ YOK';
        const activeStatus = u.isActive ? '✅ Aktif' : '🚫 Pasif';
        const expiry = u.subscriptionExpires ? u.subscriptionExpires.toLocaleDateString() : 'Belirtilmemiş';

        console.log(`İsim: ${u.name} (${u.email})`);
        console.log(`Rol: ${u.role} | Paket: ${u.tier}`);
        console.log(`Koçluk Erişimi: ${coachingStatus} | Durum: ${activeStatus}`);
        console.log(`Abonelik Bitiş: ${expiry}`);
        console.log(`ID: ${u.id}`);
        console.log('----------------------------');
    });
}

main()
    .catch(e => console.error('Hata:', e))
    .finally(async () => {
        await prisma.$disconnect();
    });
