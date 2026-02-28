import { createUploadthing, type FileRouter } from 'uploadthing/express';

const f = createUploadthing();

export const uploadRouter = {
  questionImage: f({
    image: {
      maxFileSize: '4MB',
      maxFileCount: 1,
    },
  }).onUploadComplete(async ({ metadata, file }) => {
    console.log('Upload complete for questionImage:', file.url);
    return { url: file.url };
  }),
  answerImage: f({
    image: {
      maxFileSize: '4MB',
      maxFileCount: 1,
    },
  }).onUploadComplete(async ({ metadata, file }) => {
    console.log('Upload complete for answerImage:', file.url);
    return { url: file.url };
  }),
} satisfies FileRouter;

export type OurFileRouter = typeof uploadRouter;
