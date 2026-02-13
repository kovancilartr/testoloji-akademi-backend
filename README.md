# 🛡️ Testoloji Akademi API - Güçlü Eğitim Altyapısı

Testoloji Akademi API, eğitim süreçlerini yönetmek, kurs içerikleri oluşturmak ve öğrenci performansını anlık olarak takip etmek için geliştirilmiş, **NestJS** tabanlı kurumsal seviyede bir backend sistemidir.

<p align="center">
  <img src="https://nestjs.com/img/logo-small.svg" width="80" alt="Nest Logo" />
  <img src="https://www.prisma.io/images/favicon-32x32.png" width="30" alt="Prisma Logo" />
</p>

## ✨ Temel Özellikler

### 🔐 Gelişmiş Yetkilendirme
*   **Role-Based Access Control (RBAC):** Admin, Öğretmen ve Öğrenci rolleri için özelleştirilmiş erişim kontrolleri.
*   **JWT Authentication:** Güvenli oturum yönetimi ve istek doğrulama.
*   **CoachingAccessGuard:** Eğitmenler için özel koçluk modülü yetki kontrolü.

### 📚 Akademi & Kurs Yönetimi
*   **Esnek Müfredat Yapısı:** Kurs -> Bölüm (Module) -> İçerik (Content) hiyerarşisi.
*   **Çoklu İçerik Desteği:** Video dersler, PDF dökümanları ve interaktif Testler.
*   **Gelişmiş Sıralama:** Sürükle-bırak işlemleri için optimize edilmiş veritabanı işlemleri (Prisma Transactions).

### 📊 Performans Analizi & Raporlama
*   **Detaylı İstatistikler:** Doğru, Yanlış ve Net (4Y 1D) hesaplama algoritmaları.
*   **Sınıf Genel Durumu:** Öğretmenler için sınıf başarısı ve gelişim trendleri.
*   **Öğrenci Karnesi:** Her öğrenci için geçmiş sınav başarıları ve gelişim grafikleri.

---

## 🛠️ Teknoloji Yığını

*   **Framework:** [NestJS](https://nestjs.com/) (Modular, Scalable)
*   **ORM:** [Prisma](https://www.prisma.io/) (Type-safe database client)
*   **Database:** PostgreSQL (Veri bütünlüğü ve performans)
*   **Validation:** `class-validator` & `class-transformer`
*   **Security:** Passport JWT, Bcrypt

---

## 📖 API Endpoint Dokümantasyonu

Tüm API uçları (Auth hariç) Header'da `Authorization: Bearer <token>` gerektirir.

### 🔑 Kimlik Doğrulama (`/auth`)
| Method | Endpoint | Erişim | Açıklama |
| :--- | :--- | :--- | :--- |
| POST | `/register` | Public | Yeni kullanıcı kaydı oluşturur. |
| POST | `/login` | Public | Kullanıcı girişi ve JWT token üretimi. |
| POST | `/refresh` | Public | Refresh token ile yeni access token alır. |
| POST | `/logout` | Public | Oturumu sonlandırır. |
| GET | `/me` | Herkes | Mevcut kullanıcı profil bilgilerini döner. |
| PATCH | `/change-password` | Herkes | Şifre güncelleme işlemi. |

### 👥 Kullanıcı Yönetimi (`/users`)
| Method | Endpoint | Erişim | Açıklama |
| :--- | :--- | :--- | :--- |
| GET | `/` | ADMIN | Sistemdeki tüm kullanıcıları listeler. |
| GET | `/stats` | ADMIN | Genel sistem istatistiklerini (kullanıcı sayısı vb.) döner. |
| PATCH | `/:id/role` | ADMIN | Kullanıcı rolünü veya abonelik paketini günceller. |
| PATCH | `/:id/status` | ADMIN | Kullanıcı hesabını dondurur/etkinleştirir. |
| PATCH | `/:id/coaching-access` | ADMIN | Kullanıcıya koçluk modülü yetkisi verir/alır. |
| DELETE | `/:id` | ADMIN | Kullanıcı kaydını sistemden siler. |

### 🎓 Akademi & Öğrenci Yönetimi (`/academy`)
| Method | Endpoint | Erişim | Açıklama |
| :--- | :--- | :--- | :--- |
| POST | `/students` | TEACHER, ADMIN | Yeni bir öğrenci kaydı oluşturur. |
| GET | `/students` | TEACHER, ADMIN | Öğretmene bağlı öğrencileri listeler. |
| GET | `/students/:id` | TEACHER, ADMIN | Belirli bir öğrencinin detaylı bilgilerini döner. |
| PATCH | `/students/:id` | TEACHER, ADMIN | Öğrenci bilgilerini günceller. |
| DELETE | `/students/:id` | TEACHER, ADMIN | Öğrenci kaydını siler. |

### 📚 Kurs & Müfredat Yönetimi (`/courses`)
| Method | Endpoint | Erişim | Açıklama |
| :--- | :--- | :--- | :--- |
| GET | `/admin/all` | ADMIN | Tüm sistem kurslarını listeler. |
| GET | `/my-courses` | STUDENT | Öğrencinin kayıtlı olduğu kursları listeler. |
| POST | `/` | TEACHER, ADMIN | Yeni kurs oluşturur. |
| POST | `/:id/modules` | TEACHER, ADMIN | Kursa yeni bölüm (modül) ekler. |
| POST | `/modules/:id/contents` | TEACHER, ADMIN | Bölüme yeni içerik (video/pdf/test) ekler. |
| POST | `/:id/enroll` | TEACHER, ADMIN | Öğrenciyi kursa kaydeder. |

### 📝 Ödev Sistemi (`/assignments`)
| Method | Endpoint | Erişim | Açıklama |
| :--- | :--- | :--- | :--- |
| GET | `/` | Herkes | Atanmış ödevleri listeler. |
| POST | `/` | TEACHER, ADMIN | Bir veya birden fazla öğrenciye ödev atar. |
| POST | `/:id/submit` | Herkes | Ödev cevaplarını gönderir ve değerlendirir. |
| GET | `/:id` | Herkes | Ödev sonucunu ve detaylarını döner. |

### 📅 Ders Programı (`/schedule`)
| Method | Endpoint | Erişim | Açıklama |
| :--- | :--- | :--- | :--- |
| GET | `/` | Herkes | Kişisel veya öğrenci takvimini döner. |
| POST | `/` | TEACHER, ADMIN | Takvime yeni bir çalışma/ders ekler. |
| DELETE | `/:id` | TEACHER, ADMIN | Takvim öğesini siler. |
| PATCH | `/:id/complete` | Herkes | Görevi tamamlandı olarak işaretler. |

### 🧠 Soru Bankası & Projeler (`/projects` & `/questions`)
| Method | Endpoint | Erişim | Açıklama |
| :--- | :--- | :--- | :--- |
| POST | `/projects` | Herkes | Yeni bir test projesi oluşturur. |
| POST | `/questions/upload` | Herkes | Projeye tekil soru (görsel) yükler. |
| POST | `/questions/bulk-upload` | Herkes | Çoklu soru yükleme işlemi başlatır. |
| POST | `/questions/reorder` | Herkes | Proje içindeki soru sıralamasını günceller. |

---

## 🚀 Kurulum & Çalıştırma

1.  **Bağımlılıklar:** `npm install`
2.  **Veritabanı:** `.env` dosyasını oluşturun ve `npx prisma db push` çalıştırın.
3.  **Başlat:** `npm run start:dev`

---

## 🔍 Hata Ayıklama & İzleme (Debug System)

Sistemin arka planındaki verileri hızlıca kontrol etmek, veritabanı ilişkilerini doğrulamak ve teknik sorunları çözmek için özelleştirilmiş hata ayıklama (debug) scriptleri mevcuttur. 

Bu scriptler `scripts/debug/` klasörü altında toplanmıştır.

### 🛠️ Mevcut Scriptler

| Dosya | Açıklama | Çalıştırma Komutu |
| :--- | :--- | :--- |
| `debug-system.ts` | **Sistem Özeti:** Genel istatistikler ve son 5 kayıt. | `npx ts-node scripts/debug/debug-system.ts` |
| `debug-users.ts` | **Yetki Kontrolü:** Roller, abonelikler ve aktiflik. | `npx ts-node scripts/debug/debug-users.ts` |
| `debug-students.ts` | **Öğrenci Bağları:** Öğrenci-öğretmen ilişkileri. | `npx ts-node scripts/debug/debug-students.ts` |
| `debug-assignments.ts` | **Ödev Takibi:** Ödev durumları ve başarı oranları. | `npx ts-node scripts/debug/debug-assignments.ts` |
| `debug-schedules.ts` | **Ders Programı:** Takvim öğeleri ve tamamlanma durumu. | `npx ts-node scripts/debug/debug-schedules.ts` |
| `debug-courses.ts` | **Kurs Yapısı:** Kurslar, modüller ve müfredat hiyerarşisi. | `npx ts-node scripts/debug/debug-courses.ts` |
| `debug-projects.ts` | **İçerik Analizi:** Projeler ve içerdiği soru sayıları. | `npx ts-node scripts/debug/debug-projects.ts` |
| `debug-notifications.ts` | **Bildirimler:** Son bildirimlerin takibi ve durumu. | `npx ts-node scripts/debug/debug-notifications.ts` |

> ⚠️ **Not:** Bu scriptler doğrudan veritabanına sorgu atar. Geliştirme sürecinde veya teknik destek sırasında kullanımı önerilir.

---

## 📑 Son Güncellemeler (13.02.2026)

Bugün sistem genelinde hem backend istatistik altyapısı genişletildi, hem de frontend tarafında performans ve görsel iyileştirmeler yapıldı.

### 📊 Admin Panel & İstatistik Genişletme
- **Backend (`/users/stats`):** Admin istatistik uç noktası tamamen yenilenerek şu veriler eklendi:
  - Toplam Kurs, Ödev, Koçluk ve Kurs Kaydı sayıları.
  - Aktif Kullanıcı (7 günlük) ve Yeni Kayıt (30 günlük) trendleri.
  - Rol ve Paket dağılımları (Pie chart verisi).
  - En son kayıt olan 5 kullanıcının detaylı listesi.
- **Yenilenen Admin Dashboard:** 
  - Modern, kartlı ve grafikli yeni tasarım.
  - Rol ve Paket dağılımı görselleştirmeleri.
  - Hızlı erişim paneli (Kullanıcılar, Kurslar, Projeler, Ayarlar).
  - Ödev tamamlanma oranları ve sistem servis durumları göstergesi.

### 🎨 Görsel & Mobil Uyumluluk (Responsive)
- **AI Koçluk Paneli:** Mobil cihazlar için tam ekran modu ve optimize edilmiş sohbet balonları eklendi.
- **Admin Ayarlar Sayfası:** Mobilde kart tabanlı görünüme geçilerek API Key ve Model yönetimi kolaylaştırıldı.
- **Admin Dashboard:** Tüm istatistik ve grafik bölümleri mobil ekranlara (375x812) tam uyumlu hale getirildi.
- **Z-Index Fix:** Mobil sidebar ve overlay çakışmaları (z-index: 400) giderildi.

### 🚀 Performans & Cache (TanStack Query)
- **Global Caching:** Tüm ana veri çekme hook'larına (`useUsers`, `useCourses`, `useProjects`, `useAnalytics` vb.) **5 dakika `staleTime`** eklendi. Sayfa geçişlerinde backend'e gereksiz istek atılması engellendi.
- **Smart Invalidation:** Veri değiştiğinde (kurs silme, kullanıcı güncelleme vb.) ilgili cache bölümleri anında geçersiz kılınarak verilerin her zaman güncel kalması sağlandı.
- **Focus Optimizasyonu:** Uygulama odağını değiştirdiğinizde (`refetchOnWindowFocus`) tetiklenen lüzumsuz API çağrıları kapatıldı.

### 🎓 Kurs Yönetimi
- **Kurs Silme:** Adminler için "Kurs Sil" fonksiyonu ve güvenli bir onay diyaloğu eklendi. Tüm modül ve içeriklerin temizlenmesi sağlandı.

---

## 📝 Lisans
Bu proje özel bir mülkiyettir. Tüm hakları saklıdır.
