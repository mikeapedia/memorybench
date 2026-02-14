import { createOpenAI } from "@ai-sdk/openai"
import { generateText } from "ai"
import type { Judge, JudgeConfig, JudgeInput, JudgeResult } from "../types/judge"
import type { ProviderPrompts } from "../types/prompts"
import { buildJudgePrompt, parseJudgeResponse, getJudgePrompt } from "./base"
import { logger } from "../utils/logger"
import { getModelConfig, ModelConfig, DEFAULT_JUDGE_MODELS } from "../utils/models"

export class OllamaJudge implements Judge {
    name = "ollama"
    private modelConfig: ModelConfig | null = null
    private client: ReturnType<typeof createOpenAI> | null = null

    async initialize(config: JudgeConfig): Promise<void> {
        const baseURL = config.baseUrl || "http://localhost:11434/v1"

        // Create an OpenAI-compatible client pointing to Ollama
        this.client = createOpenAI({
            apiKey: "ollama", // Ollama doesn't require an API key, but we pass a dummy one
            baseURL,
        })

        const modelAlias = config.model || DEFAULT_JUDGE_MODELS.ollama
        this.modelConfig = getModelConfig(modelAlias)

        logger.info(
            `Initialized Ollama judge with model: ${this.modelConfig.displayName} (${this.modelConfig.id}) at ${baseURL}`
        )
    }

    async evaluate(input: JudgeInput): Promise<JudgeResult> {
        if (!this.client || !this.modelConfig) throw new Error("Judge not initialized")

        const prompt = buildJudgePrompt(input)

        const params: Record<string, unknown> = {
            model: this.client(this.modelConfig.id),
            prompt,
        }

        if (this.modelConfig.supportsTemperature) {
            params.temperature = this.modelConfig.defaultTemperature
        }

        params.maxTokens = this.modelConfig.defaultMaxTokens

        const { text } = await generateText(params as Parameters<typeof generateText>[0])

        return parseJudgeResponse(text)
    }

    getPromptForQuestionType(questionType: string, providerPrompts?: ProviderPrompts): string {
        return getJudgePrompt(questionType, providerPrompts)
    }

    getModel() {
        if (!this.client || !this.modelConfig) throw new Error("Judge not initialized")
        return this.client(this.modelConfig.id)
    }
}

export default OllamaJudge
