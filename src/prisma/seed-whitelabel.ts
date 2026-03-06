import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Seedleme başlıyor...');

    // 1. Örnek Organizasyon Oluştur (Okidemy)
    const okidemy = await prisma.organization.upsert({
        where: { slug: 'okidemy' },
        update: {},
        create: {
            name: 'Okidemy',
            slug: 'okidemy',
            primaryColor: '#8b5cf6', // Mor tonu
            logoUrl: 'https://cdn-icons-png.flaticon.com/512/3429/3429433.png', // Örnek logo
            faviconUrl: 'https://cdn-icons-png.flaticon.com/512/3429/3429433.png',
            favTitle: 'Okidemy | Başarıya Giden Yol',
            customDomain: 'okidemy.com',
        },
    });

    console.log('Organizasyon oluşturuldu:', okidemy.name);

    // 2. Bu organizasyona bağlı bir öğretmen/öğrenci oluşturulabilir (Opsiyonel)

    console.log('Seedleme tamamlandı.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
