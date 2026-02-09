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
*   **Gelişmiş Sıralama:** Sürükle-bırak işlemleri için optimize edilmiş veritabanı işlemler (Prisma Transactions).
*   **Yayın Kontrolü:** Kursları taslak modunda hazırlama ve tek tıkla öğrencilere açma.

### 📊 Performans Analizi & Raporlama
*   **Detaylı İstatistikler:** Doğru, Yanlış ve Net (4Y 1D) hesaplama algoritmaları.
*   **Sınıf Genel Durumu:** Öğretmenler için sınıf başarısı ve gelişim trendleri.
*   **Öğrenci Karnesi:** Her öğrenci için geçmiş sınav başarıları ve gelişim grafikleri.

### 👥 Öğrenci Yönetimi
*   **Dinamik Kayıt:** Öğrencileri tekil veya toplu olarak kurslara atama/çıkarma.
*   **İlerleme Takibi:** Hangi öğrencilerin hangi içerikleri tamamladığını anlık görme.

## 🛠️ Teknoloji Yığını

*   **Framework:** [NestJS](https://nestjs.com/) (Modular, Scalable)
*   **ORM:** [Prisma](https://www.prisma.io/) (Type-safe database client)
*   **Database:** PostgreSQL (Veri bütünlüğü ve performans)
*   **Validation:** `class-validator` & `class-transformer`
*   **Security:** Passport JWT, Bcrypt

## 🚀 Hızlı Başlangıç

### Gereksinimler
*   Node.js v18+
*   PostgreSQL Database

### Kurulum Adımları

1.  **Bağımlılıkları Yükleyin:**
    ```bash
    npm install
    ```

2.  **Çevresel Değişkenleri Ayarlayın (.env):**
    ```env
    DATABASE_URL="postgresql://user:password@localhost:5432/testoloji"
    JWT_SECRET="gizli-anahtar"
    ```

3.  **Veritabanı Şemasını Hazırlayın:**
    ```bash
    npx prisma generate
    npx prisma db push
    ```

4.  **Uygulamayı Başlatın:**
    ```bash
    npm run start:dev
    ```

## 📖 API Dokümantasyonu

Backend servisleri aşağıdaki temel modüllerden oluşmaktadır:
*   `/auth`: Kayıt, Giriş ve Yetkilendirme işlemleri.
*   `/courses`: Kurs oluşturma, güncelleme ve yayınlama.
*   `/modules`: Kurs bölümlerinin yönetimi ve sıralanması.
*   `/assignments`: Sınav atamaları ve öğrenci cevaplarının değerlendirilmesi.
*   `/analytics`: Öğretmen ve öğrenciler için dashboard verileri.

---
## 📝 Lisans
Bu proje özel bir mülkiyettir. Tüm hakları saklıdır.
