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
## 📝 Lisans
Bu proje özel bir mülkiyettir. Tüm hakları saklıdır.
