/**
 * DEBUG: Bildirim Takibi
 * 
 * Veritabanındaki son bildirimleri listeler. Bildirimlerin doğru kişilere
 * gidip gitmediğini ve okunma durumlarını kontrol etmek için kullanılır.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('\n--- 🔔 SİSTEMDEKİ SON 15 BİLDİRİM ---');

    const notifications = await prisma.notification.findMany({
        take: 15,
        orderBy: { createdAt: 'desc' },
        include: {
            user: { select: { name: true, email: true, role: true } }
        }
    });

    if (notifications.length === 0) {
        console.log('Henüz bildirim bulunmuyor.');
        return;
    }

    notifications.forEach(n => {
        const readStatus = n.isRead ? '✅ Okundu' : '📩 OKUNMADI';
        console.log(`[${n.createdAt.toLocaleString()}] ${readStatus}`);
        console.log(`Kime: ${n.user?.name} (${n.user?.email}) - Rol: ${n.user?.role}`);
        console.log(`Başlık: ${n.title}`);
        console.log(`Mesaj: ${n.message}`);
        console.log(`Tip: ${n.type}`);
        console.log('----------------------------');
    });
}

main()
    .catch(e => console.error('Hata:', e))
    .finally(async () => {
        await prisma.$disconnect();
    });
