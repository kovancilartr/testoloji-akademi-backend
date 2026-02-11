/**
 * DEBUG: Öğrenci ve Öğretmen İlişkileri
 * 
 * Öğrencilerin hangi öğretmenlere bağlı olduğunu, sisteme kayıtlı olup olmadıklarını
 * ve temel iletişim bilgilerini listeler. Koçluk ilişkilerini doğrulamak için kullanılır.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('\n--- 🎓 ÖĞRENCİ - ÖĞRETMEN BAĞLANTI LİSTESİ ---');

    const students = await prisma.student.findMany({
        include: {
            teacher: { select: { name: true, email: true } },
            user: { select: { email: true, isActive: true } }
        },
        orderBy: { name: 'asc' }
    });

    if (students.length === 0) {
        console.log('Sistemde henüz kayıtlı öğrenci bulunmuyor.');
        return;
    }

    students.forEach(s => {
        const loginStatus = s.user
            ? `✅ Kayıtlı Kullanıcı (${s.user.email})`
            : '👤 Sanal Öğrenci (Sadece öğretmen görür)';

        console.log(`Öğrenci: ${s.name} (${s.gradeLevel || 'Sınıf Yok'})`);
        console.log(`Öğretmen: ${s.teacher?.name || 'Bilinmiyor'} (${s.teacher?.email || 'Bilinmiyor'})`);
        console.log(`Sistem Durumu: ${loginStatus}`);
        console.log(`Email/Tel: ${s.email || '-'} / ${s.phone || '-'}`);
        console.log(`Öğrenci ID: ${s.id}`);
        console.log('----------------------------');
    });
}

main()
    .catch(e => console.error('Hata:', e))
    .finally(async () => {
        await prisma.$disconnect();
    });
