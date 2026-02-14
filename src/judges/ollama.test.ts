import { describe, expect, test, mock, beforeEach } from "bun:test"
import { OllamaJudge } from "./ollama"

// Mock the dependencies
const mockGenerateText = mock(() => Promise.resolve({ text: '{"score": 1, "label": "correct"}' }))
const mockOpenAIClient = mock(() => "mock-model")
const mockCreateOpenAI = mock(() => mockOpenAIClient)

mock.module("ai", () => ({
    generateText: mockGenerateText
}))

mock.module("@ai-sdk/openai", () => ({
    createOpenAI: mockCreateOpenAI
}))

// Removed mock for ../utils/models to prevent leakage


describe("OllamaJudge", () => {
    let judge: OllamaJudge

    beforeEach(() => {
        judge = new OllamaJudge()
        mockGenerateText.mockClear()
        mockCreateOpenAI.mockClear()
    })

    test("should initialize with default config", async () => {
        // We'll use a mocked config or assume "ollama:llama3" logic works if we don't mock.
        // But since we removed the mock, we need to ensure getModelConfig works.
        // Let's rely on the real getModelConfig if possible, 
        // OR better: mock the method directly on the class if we can (but it's private/internal usage).

        // Actually, without the mock, getModelConfig might fail if "llama3" isn't in the real dictionary.
        // Let's assume we pass a config that resolves correctly.
        // Or we can mock the import differently? 
        // Bun test module mocking is sticky.

        await judge.initialize({ apiKey: "dummy", model: "ollama-llama3" })
        // Defaults to localhost
        expect(mockCreateOpenAI).toHaveBeenCalledWith({
            apiKey: "ollama",
            baseURL: "http://localhost:11434/v1"
        })
    })

    test("should initialize with custom baseUrl", async () => {
        await judge.initialize({ apiKey: "dummy", baseUrl: "http://custom:11434", model: "ollama-llama3" })
        expect(mockCreateOpenAI).toHaveBeenCalledWith({
            apiKey: "ollama",
            baseURL: "http://custom:11434"
        })
    })

    test("should evaluate using generateText", async () => {
        await judge.initialize({ apiKey: "dummy", model: "ollama-llama3" })

        const input = {
            question: "Q",
            groundTruth: "A",
            hypothesis: "B",
            questionType: "fact",
            providerPrompts: {}
        }

        const result = await judge.evaluate(input)

        expect(mockGenerateText).toHaveBeenCalled()
        expect(result).toEqual({
            score: 1,
            label: "correct",
            explanation: ""
        })
    })

    test("should throw if evaluating before initialization", async () => {
        const input = {
            question: "Q",
            groundTruth: "A",
            hypothesis: "B",
            questionType: "fact",
            providerPrompts: {}
        }

        expect(judge.evaluate(input)).rejects.toThrow("Judge not initialized")
    })
})
