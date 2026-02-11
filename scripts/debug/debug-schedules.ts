/**
 * DEBUG: Ders Programı ve Çalışma Takvimi
 * 
 * Öğrencilerin haftalık veya belirli tarihlerdeki çalışma programlarını listeler.
 * Takvim çakışmalarını ve tamamlanma durumlarını kontrol etmek için kullanılır.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('\n--- 📅 DERS PROGRAMI & ÇALIŞMA TAKVİMİ ---');

    const schedules = await prisma.schedule.findMany({
        include: {
            student: { select: { name: true } }
        },
        orderBy: [
            { date: 'desc' },
            { dayOfWeek: 'asc' }
        ],
        take: 20
    });

    if (schedules.length === 0) {
        console.log('Sistemde henüz kayıtlı bir takvim öğesi bulunmuyor.');
        return;
    }

    const days = ['Hergün', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];

    schedules.forEach(s => {
        const status = s.isCompleted ? '✅ Tamamlandı' : '⏳ Bekliyor';
        const time = (s.startTime && s.endTime) ? `${s.startTime} - ${s.endTime}` : 'Saat Belirtilmemiş';
        const dateStr = s.date ? s.date.toLocaleDateString() : (s.dayOfWeek ? days[s.dayOfWeek] : 'Belirsiz Gün');

        console.log(`[${status}] ${s.activity}`);
        console.log(`Öğrenci: ${s.student?.name} | Vakit: ${dateStr} (${time})`);
        console.log(`ID: ${s.id}`);
        console.log('----------------------------');
    });
}

main()
    .catch(e => console.error('Hata:', e))
    .finally(async () => {
        await prisma.$disconnect();
    });
