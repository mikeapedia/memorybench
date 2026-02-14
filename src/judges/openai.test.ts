import { describe, expect, test, beforeEach, afterEach, mock } from "bun:test"
import { OpenAIJudge } from "./openai"

// Mock dependencies
const mockGenerateText = mock(() => Promise.resolve({ text: '{"score": 1, "label": "correct", "explanation": ""}' }))
// createOpenAI returns a provider instance, which is a function that returns the model
// usage: const openai = createOpenAI(...); const model = openai("gpt-4o");
const mockProviderInstance = mock(() => ({}))
const mockCreateOpenAI = mock(() => mockProviderInstance)

mock.module("@ai-sdk/openai", () => ({
    createOpenAI: mockCreateOpenAI
}))

mock.module("ai", () => ({
    generateText: mockGenerateText
}))

describe("OpenAIJudge", () => {
    let judge: OpenAIJudge

    beforeEach(() => {
        judge = new OpenAIJudge()
        mockGenerateText.mockClear()
        mockCreateOpenAI.mockClear()
    })

    test("should initialize with default config", async () => {
        await judge.initialize({ apiKey: "dummy-key", model: "gpt-4o" })
        expect(mockCreateOpenAI).toHaveBeenCalledWith({
            apiKey: "dummy-key"
        })
    })

    test("should evaluate using generateText", async () => {
        await judge.initialize({ apiKey: "dummy", model: "gpt-4o" })

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

    test("should handle API errors gracefully", async () => {
        await judge.initialize({ apiKey: "dummy", model: "gpt-4o" })
        mockGenerateText.mockRejectedValue(new Error("API Error"))

        const input = {
            question: "Q",
            groundTruth: "A",
            hypothesis: "B",
            questionType: "fact",
            providerPrompts: {}
        }

        // The judge implementation currently throws on error, which is expected behavior
        // to be caught by the orchestrator.
        expect(judge.evaluate(input)).rejects.toThrow("API Error")
    })
})
