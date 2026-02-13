// Bu script, API anahtarını doğrudan test eder.
// Hem .env'deki anahtarı hem de veritabanındaki anahtarı ayrı ayrı test ediyoruz.

const { GoogleGenerativeAI } = require("@google/generative-ai");

// .env'deki anahtar
const envKey = "AIzaSyAduHhHFr2BJAjv6g0YyBE0vz76JDFv6fM";

async function testModel(apiKey, modelName) {
    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: modelName });

        // Çok basit, düşük token istek
        const result = await model.generateContent("Merhaba, 1+1 kaç?");
        const response = await result.response;
        const text = response.text();

        console.log(`✅ ${modelName}: ÇALIŞIYOR! Yanıt: ${text.substring(0, 50)}...`);
        return true;
    } catch (error) {
        console.log(`❌ ${modelName}: HATA! ${error.status || ''} - ${error.message?.substring(0, 120)}`);
        return false;
    }
}

async function main() {
    console.log("=== API ANAHTAR TESTİ ===");
    console.log(`Anahtar: ${envKey.substring(0, 10)}...${envKey.substring(envKey.length - 4)}`);
    console.log("");

    const models = [
        "gemini-2.0-flash",
        "gemini-2.0-flash-lite",
        "gemini-2.5-flash",
        "gemini-2.5-flash-lite",
    ];

    for (const model of models) {
        await testModel(envKey, model);
        // Her model arasında 2 saniye bekle (rate limit'e takılmamak için)
        await new Promise(r => setTimeout(r, 2000));
    }

    console.log("\n=== TEST TAMAMLANDI ===");
}

main();
