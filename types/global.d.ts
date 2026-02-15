/// <reference types="vite-plugin-pwa/client" />

export {};

declare global {
  interface QuestionRecord {
    id: number;
    timeSpent: number;
  }

  interface ExamConfig {
    totalQuestions: number;
    totalTimeInMinutes: number;
    alertThreshold: number;
  }

  type ExamTheme = "dark" | "cupcake" | "bumblebee" | "emerald" | "corporate" | "synthwave";
}