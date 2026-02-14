import { describe, expect, test, beforeAll, afterAll } from "bun:test"
import { getProviderConfig, getJudgeConfig, config, setEnsembleConfig, getEnsembleConfig } from "./config"

// Mock process.env
const originalEnv = process.env

describe("Config Utils", () => {
    describe("getProviderConfig", () => {
        test("should return config for supermemory", () => {
            const cfg = getProviderConfig("supermemory")
            expect(cfg.apiKey).toBe(config.supermemoryApiKey)
            expect(cfg.baseUrl).toBe(config.supermemoryBaseUrl)
        })

        test("should return config for mem0", () => {
            const cfg = getProviderConfig("mem0")
            expect(cfg.apiKey).toBe(config.mem0ApiKey)
        })

        test("should throw error for unknown provider", () => {
            expect(() => getProviderConfig("unknown")).toThrow("Unknown provider: unknown")
        })

        test("should return ensemble config", () => {
            const mockEnsembleConfig = {
                routing: { default: "supermemory" },
                providers: [{ name: "supermemory", weight: 1 }]
            } as any
            setEnsembleConfig(mockEnsembleConfig)
            const cfg = getProviderConfig("ensemble")
            expect(cfg.ensembleConfig).toBe(mockEnsembleConfig)
        })
    })

    describe("getJudgeConfig", () => {
        test("should return config for openai judge", () => {
            const cfg = getJudgeConfig("openai")
            expect(cfg.apiKey).toBe(config.openaiApiKey)
        })

        test("should return config for ollama judge", () => {
            const cfg = getJudgeConfig("ollama")
            expect(cfg.apiKey).toBe("ollama")
            expect(cfg.baseUrl).toBe(config.ollamaBaseUrl)
        })

        test("should throw error for unknown judge", () => {
            expect(() => getJudgeConfig("unknown")).toThrow("Unknown judge: unknown")
        })
    })
})
