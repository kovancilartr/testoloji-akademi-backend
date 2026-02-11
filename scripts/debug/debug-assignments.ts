/**
 * DEBUG: Ödev Takibi ve İstatistikleri
 * 
 * Atanan tüm ödevlerin durumlarını, türlerini ve başarı oranlarını listeler.
 * Ödev sistemindeki akış hatalarını tespit etmek için kullanılır.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('\n--- 📝 ÖDEV TAKİP MERKEZİ ---');

    const assignments = await prisma.assignment.findMany({
        include: {
            student: { select: { name: true } },
            project: { select: { name: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: 30
    });

    if (assignments.length === 0) {
        console.log('Sistemde henüz atanmış ödev bulunmuyor.');
        return;
    }

    assignments.forEach(a => {
        const successRate = a.grade !== null ? `%${a.grade}` : 'Henüz Yapılmadı';
        const typeIcon = a.type === 'TEST' ? '📝 TEST' : '🔗 DİĞER';

        console.log(`[${a.status}] ${a.title}`);
        console.log(`Tip: ${typeIcon} | Öğrenci: ${a.student?.name || 'Bilinmiyor'}`);
        console.log(`Başarı: ${successRate} | Deneme: ${a.attemptCount}/${a.allowedAttempts}`);
        if (a.project) console.log(`Bağlı Proje: ${a.project.name}`);
        console.log(`ID: ${a.id}`);
        console.log('----------------------------');
    });
}

main()
    .catch(e => console.error('Hata:', e))
    .finally(async () => {
        await prisma.$disconnect();
    });
