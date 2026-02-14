import { describe, expect, test } from "bun:test"
import { buildJudgePrompt, parseJudgeResponse } from "./base"

describe("Judge Utils", () => {
    describe("parseJudgeResponse", () => {
        test("should parse valid JSON response", () => {
            const response = '{"score": 1, "label": "correct", "explanation": "Good match"}'
            const result = parseJudgeResponse(response)
            expect(result).toEqual({
                score: 1,
                label: "correct",
                explanation: "Good match",
            })
        })

        test("should parse JSON inside markdown code block", () => {
            const response = 'Here is the result:\n```json\n{"score": 0, "label": "incorrect", "explanation": "Bad match"}\n```'
            const result = parseJudgeResponse(response)
            expect(result).toEqual({
                score: 0,
                label: "incorrect",
                explanation: "Bad match",
            })
        })

        test("should fallback to text parsing if JSON is invalid", () => {
            const response = 'The answer is "correct" because it matches.'
            const result = parseJudgeResponse(response)
            expect(result).toEqual({
                score: 1,
                label: "correct",
                explanation: "Failed to parse judge response",
            })
        })

        test("should handle incorrect in text fallback", () => {
            const response = "The answer is Incorrect."
            const result = parseJudgeResponse(response)
            expect(result).toEqual({
                score: 0,
                label: "incorrect",
                explanation: "Failed to parse judge response",
            })
        })

        test("should normalize binary scores", () => {
            const response = '{"score": 0.9, "label": "correct"}'
            const result = parseJudgeResponse(response)
            // The implementation casts score === 1 ? 1 : 0. 
            // So 0.9 should become 0 based on current logic, unless we want to change that.
            // Looking at base.ts: `score: parsed.score === 1 ? 1 : 0`
            expect(result.score).toBe(0)
        })
    })

    describe("buildJudgePrompt", () => {
        test("should build default prompt for standard question", () => {
            const input = {
                question: "What is X?",
                groundTruth: "X is Y",
                hypothesis: "X is Z",
                questionType: "fact",
                providerPrompts: {},
            }
            const prompt = buildJudgePrompt(input)
            expect(prompt).toContain("Question: What is X?")
            expect(prompt).toContain("Ground Truth Answer: X is Y")
            expect(prompt).toContain("System's Hypothesis: X is Z")
        })

        test("should use Rubric label for preference questions", () => {
            const input = {
                question: "Compare A and B",
                groundTruth: "A is better",
                hypothesis: "B is better",
                questionType: "preference", // Contains "preference"
                providerPrompts: {},
            }
            const prompt = buildJudgePrompt(input)
            expect(prompt).toContain("Rubric: A is better")
        })

        test("should use custom provider prompt if available", () => {
            const customPrompt = "Custom Template"
            const input = {
                question: "Q",
                groundTruth: "GT",
                hypothesis: "H",
                questionType: "custom",
                providerPrompts: {
                    judgePrompt: () => ({
                        custom: customPrompt,
                        default: "Default"
                    })
                }
            }
            const prompt = buildJudgePrompt(input)
            expect(prompt).toBe(customPrompt)
        })
    })
})
