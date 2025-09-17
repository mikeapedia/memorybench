import type { RAGBenchmarkItem } from './RAG/types';

export interface BenchmarkRegistry {
  'RAG': RAGBenchmarkItem;
  // Future benchmarks can be added here
  // 'QA': QABenchmarkItem;
  // 'Summarization': SummarizationBenchmarkItem;
}

export type BenchmarkType = keyof BenchmarkRegistry;
export type BenchmarkData<T extends BenchmarkType> = BenchmarkRegistry[T];

// Export all benchmark types and data
export * from './RAG';