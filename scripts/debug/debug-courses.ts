/**
 * DEBUG: LMS Kurs ve Müfredat Yapısı
 * 
 * Sistemdeki kursları, modülleri ve içerikleri hiyerarşik olarak listeler.
 * Kurs içeriklerinin doğru yayınlanıp yayınlanmadığını kontrol etmek için kullanılır.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('\n--- 📚 KURS VE MÜFREDAT YAPISI ---');

    const courses = await prisma.course.findMany({
        include: {
            instructor: { select: { name: true } },
            modules: {
                include: {
                    _count: { select: { contents: true } }
                },
                orderBy: { order: 'asc' }
            },
            _count: { select: { enrollments: true } }
        }
    });

    if (courses.length === 0) {
        console.log('Sistemde henüz oluşturulmuş bir kurs bulunmuyor.');
        return;
    }

    courses.forEach(c => {
        const publishStatus = c.isPublished ? '✅ Yayında' : '🛠️ Taslak';
        console.log(`Kurs: ${c.title} [${publishStatus}]`);
        console.log(`Eğitmen: ${c.instructor?.name} | Öğrenci Sayısı: ${c._count.enrollments}`);
        console.log(`Modüller:`);

        if (c.modules.length === 0) {
            console.log('  - Henüz modül eklenmemiş.');
        }

        c.modules.forEach(m => {
            console.log(`  └─ ${m.title} (${m._count.contents} içerik)`);
        });

        console.log(`ID: ${c.id}`);
        console.log('----------------------------');
    });
}

main()
    .catch(e => console.error('Hata:', e))
    .finally(async () => {
        await prisma.$disconnect();
    });
