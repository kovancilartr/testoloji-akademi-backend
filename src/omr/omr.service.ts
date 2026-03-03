import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { spawn } from 'child_process';
import * as path from 'path';

@Injectable()
export class OmrService {
    private readonly pythonPath: string;
    private readonly scriptPath: string;

    constructor(
        private prisma: PrismaService,
    ) {
        // Use environment variable if provided, otherwise fallback based on platform
        this.pythonPath = process.env.PYTHON_PATH ||
            (process.env.NODE_ENV === 'production'
                ? 'python3' // Alpine/Docker system python
                : path.join(process.cwd(), 'omr-venv', 'bin', 'python3')); // Local venv

        this.scriptPath = path.join(process.cwd(), 'scripts', 'omr_processor.py');
    }

    async processOpticForm(imageBase64: string, userId: string, assignmentId?: string) {
        const scanResult: any = await this.runPythonProcessor(imageBase64);

        if (!scanResult.success) {
            throw new InternalServerErrorException(scanResult.error || 'Optik form okunamadı.');
        }

        const studentAnswers = scanResult.answers; // [{questionNumber: 1, markedOption: 'A'}, ...]
        const qrContent = scanResult.qrCode; // "PROJECT:projectId" or similar

        let finalAssignmentId = assignmentId;

        // QR Kod varsa otomatik ödev bulma mantığı
        if (qrContent && qrContent.startsWith('PROJECT:')) {
            const projectId = qrContent.split(':')[1];

            // Kullanıcının bu proje için bekleyen veya devam eden ödevini bul
            const assignment = await this.prisma.assignment.findFirst({
                where: {
                    student: { userId },
                    projectId,
                    status: { in: ['PENDING', 'IN_PROGRESS'] }
                }
            });

            if (assignment) {
                finalAssignmentId = assignment.id;
            } else {
                // QR Kod var ama bekleyen ödev yoksa hata fırlat
                throw new NotFoundException('Bu optik form bir ödevle ilişkili ancak üzerinize tanımlı bekleyen bir ödev bulunamadı.');
            }
        }

        // Eğer bir ödev ile ilişkilendirilmişse (manuel veya QR ile bulunduysa)
        if (finalAssignmentId) {
            // Sadece hesapla ama kaydetme (persist: false)
            return this.gradeAssignment(finalAssignmentId, studentAnswers, userId, false);
        }

        // QR kod yoksa ve manuel seçim de yapılmamışsa, bağımsız okuma olarak devam edebilir
        // Ancak kullanıcı ödev bekliyorsa burada da kısıtlama getirilebilir.
        // Şimdilik QR kod VARSA ve eşleşme YOKSA hata veriyoruz.

        // Sadece bağımsız bir okuma ise (Hızlı Test)
        return {
            success: true,
            answers: studentAnswers,
        };
    }

    async saveResult(assignmentId: string, userId: string, answers: Record<string, string>) {
        // Gelen cevapları dizi formatına çevir (gradeAssignment'ın beklediği format)
        // Not: Burada prisma'dan ödevi çekip analiz yapmak daha sağlıklı
        const assignment = await this.prisma.assignment.findUnique({
            where: { id: assignmentId },
            include: {
                project: {
                    include: { questions: { orderBy: { order: 'asc' } } }
                }
            }
        });

        if (!assignment || !assignment.project) throw new NotFoundException('Ödev veya proje bulunamadı.');
        const project = assignment.project;

        const studentAnswersArray = Object.entries(answers).map(([qId, option]) => {
            const q = project.questions.find(quest => quest.id === qId);
            return {
                questionNumber: q ? project.questions.indexOf(q) + 1 : 0,
                markedOption: option
            };
        }).filter(a => a.questionNumber > 0);

        return this.gradeAssignment(assignmentId, studentAnswersArray, userId, true);
    }

    private async runPythonProcessor(imageBase64: string) {
        return new Promise((resolve, reject) => {
            try {
                const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
                const pythonProcess = spawn(this.pythonPath, [this.scriptPath]);

                let resultData = '';
                let errorData = '';

                pythonProcess.stdin.write(JSON.stringify({ image: cleanBase64 }));
                pythonProcess.stdin.end();

                pythonProcess.stdout.on('data', (data) => { resultData += data.toString(); });
                pythonProcess.stderr.on('data', (data) => { errorData += data.toString(); });

                pythonProcess.on('close', (code) => {
                    if (code !== 0) {
                        console.error('Python Error:', errorData);
                        return resolve({ success: false, error: 'Görüntü işleme hatası.' });
                    }
                    try {
                        resolve(JSON.parse(resultData));
                    } catch (e) {
                        resolve({ success: false, error: 'Python çıktısı okunamadı.' });
                    }
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    private async gradeAssignment(assignmentId: string, studentAnswers: any[], userId: string, persist: boolean = true) {
        // 1. Ödevi ve bağlı olduğu projeyi çek
        const assignment = await this.prisma.assignment.findUnique({
            where: { id: assignmentId },
            include: {
                project: {
                    include: { questions: { orderBy: { order: 'asc' } } }
                }
            }
        });

        if (!assignment) throw new NotFoundException('Ödev bulunamadı.');

        const answerKey = assignment.project?.questions || [];

        let correctCount = 0;
        let incorrectCount = 0;
        let emptyCount = 0;
        const analysis: any[] = [];

        // 2. Karşılaştır ve Cevapları Hazırla (Frontend formatına uygun: {questionId: option})
        const studentAnswersMap: Record<string, string> = {};

        answerKey.forEach((q, idx) => {
            const studentAnswerObj = studentAnswers.find(a => a.questionNumber === (idx + 1));
            const studentMark = studentAnswerObj?.markedOption;
            const correctAnswer = q.correctAnswer;

            if (studentMark) {
                studentAnswersMap[q.id] = studentMark; // Frontend bu formatta bekliyor

                if (studentMark === correctAnswer) {
                    correctCount++;
                } else {
                    incorrectCount++;
                }
            } else {
                emptyCount++;
            }
        });

        const net = correctCount - (incorrectCount * 0.25);
        const score = (correctCount / (answerKey.length || 1)) * 100;

        if (persist) {
            // 3. Veritabanına kaydet
            await this.prisma.assignment.update({
                where: { id: assignmentId },
                data: {
                    status: 'COMPLETED',
                    completedAt: new Date(),
                    correctCount,
                    incorrectCount,
                    grade: score, // Başarı puanı
                    answers: studentAnswersMap as any, // {questionId: option} formatı
                }
            });
        }

        // Review ekranı için anlık analiz objesini de döndürelim (isteğe bağlı)
        const detailedAnalysis = answerKey.map((q, idx) => ({
            questionNumber: idx + 1,
            studentMark: studentAnswersMap[q.id] || null,
            correctAnswer: q.correctAnswer,
            status: !studentAnswersMap[q.id] ? 'empty' : (studentAnswersMap[q.id] === q.correctAnswer ? 'correct' : 'incorrect')
        }));

        return {
            success: true,
            assignmentId,
            stats: {
                total: answerKey.length,
                correct: correctCount,
                incorrect: incorrectCount,
                empty: emptyCount,
                net: Math.max(0, net),
                score: Math.round(score)
            },
            analysis: detailedAnalysis
        };
    }
}
