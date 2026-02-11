/**
 * DEBUG: Projeler ve Sorular
 * 
 * Veritabanındaki projeleri, hangi kullanıcıya ait olduklarını ve
 * içerdikleri soru sayılarını listeler. İçerik yönetimini kontrol etmek için kullanılır.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('\n--- 📁 PROJE VE SORU DAĞILIMI ---');

    const projects = await prisma.project.findMany({
        include: {
            user: { select: { name: true, email: true } },
            _count: { select: { questions: true } },
            settings: true
        },
        orderBy: { updatedAt: 'desc' }
    });

    if (projects.length === 0) {
        console.log('Henüz oluşturulmuş proje bulunmuyor.');
        return;
    }

    projects.forEach(p => {
        console.log(`Proje: ${p.name} | Soru Sayısı: ${p._count.questions}`);
        console.log(`Sahibi: ${p.user.name} (${p.user.email})`);
        console.log(`Renk Teması: ${p.settings?.primaryColor || 'Varsayılan'}`);
        console.log(`ID: ${p.id}`);
        console.log('----------------------------');
    });
}

main()
    .catch(e => console.error('Hata:', e))
    .finally(async () => {
        await prisma.$disconnect();
    });
