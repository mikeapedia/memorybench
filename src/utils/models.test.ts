import { describe, expect, test } from "bun:test"
import {
    getModelConfig,
    listAvailableModels,
    listModelsByProvider,
    getModelId,
    getModelProvider,
} from "./models"

describe("Model Utils", () => {
    describe("getModelConfig", () => {
        test("should return config for known model alias", () => {
            const config = getModelConfig("gpt-4o")
            expect(config.id).toBe("gpt-4o")
            expect(config.provider).toBe("openai")
            expect(config.supportsTemperature).toBe(true)
        })

        test("should infer openai provider from gpt- prefix", () => {
            const config = getModelConfig("gpt-custom-model")
            expect(config.id).toBe("gpt-custom-model")
            expect(config.provider).toBe("openai")
        })

        test("should infer anthropic provider from claude- prefix", () => {
            const config = getModelConfig("claude-custom-model")
            expect(config.id).toBe("claude-custom-model")
            expect(config.provider).toBe("anthropic")
        })

        test("should infer google provider from gemini- prefix", () => {
            const config = getModelConfig("gemini-custom-model")
            expect(config.id).toBe("gemini-custom-model")
            expect(config.provider).toBe("google")
        })

        test("should infer ollama provider from ollama- prefix", () => {
            const config = getModelConfig("ollama-my-model")
            expect(config.id).toBe("my-model")
            expect(config.provider).toBe("ollama")
            expect(config.defaultMaxTokens).toBe(4096)
        })

        test("should fallback to openai for unknown alias", () => {
            const config = getModelConfig("unknown-model")
            expect(config.id).toBe("unknown-model")
            expect(config.provider).toBe("openai")
        })
    })

    describe("listAvailableModels", () => {
        test("should return a list of model aliases", () => {
            const models = listAvailableModels()
            expect(models.length).toBeGreaterThan(0)
            expect(models).toContain("gpt-4o")
            expect(models).toContain("sonnet-4.5")
        })
    })

    describe("listModelsByProvider", () => {
        test("should return only openai models", () => {
            const models = listModelsByProvider("openai")
            expect(models).toContain("gpt-4o")
            expect(models).not.toContain("sonnet-4.5")
        })

        test("should return only anthropic models", () => {
            const models = listModelsByProvider("anthropic")
            expect(models).toContain("sonnet-4.5")
            expect(models).not.toContain("gpt-4o")
        })
    })

    describe("getModelId", () => {
        test("should return correct ID for known alias", () => {
            expect(getModelId("sonnet-4")).toBe("claude-sonnet-4-20250514")
        })
    })

    describe("getModelProvider", () => {
        test("should return correct provider for known alias", () => {
            expect(getModelProvider("sonnet-4")).toBe("anthropic")
            expect(getModelProvider("gpt-4o")).toBe("openai")
        })
    })
})
