
import { describe, expect, test, beforeAll, afterAll, mock, spyOn } from "bun:test"
import { handleRunsRoutes } from "./runs"
import { checkpointManager, CheckpointManager } from "../../orchestrator/checkpoint"

// Mock request/url objects helper
const createRequest = (method: string, path: string, body?: any) => {
    const url = new URL(`http://localhost${path}`)
    const req = new Request(url, {
        method,
        body: body ? JSON.stringify(body) : undefined,
    })
    return { req, url }
}

describe("Runs Routes", () => {
    describe("GET /api/runs/:runId/questions/:questionId", () => {
        const runId = "test-run"
        const questionId = "q1"

        beforeAll(() => {
            // Mock CheckpointManager prototype as runs.ts creates its own instance
            CheckpointManager.prototype.load = mock((id) => {
                if (id === runId) {
                    return {
                        runId,
                        questions: {
                            [questionId]: {
                                questionId,
                                question: "test question",
                            }
                        }
                    } as any
                }
                return null
            }) as any
        })

        afterAll(() => {
            // Restore implementation
            mock.restore()
        })

        test("should return question details for valid IDs", async () => {
            const { req, url } = createRequest("GET", `/api/runs/${runId}/questions/${questionId}`)
            const res = await handleRunsRoutes(req, url)
            expect(res).not.toBeNull()
            expect(res?.status).toBe(200)
            const data = await res?.json()
            expect(data.questionId).toBe(questionId)
        })

        test("should reject path traversal in questionId", async () => {
            const maliciousId = encodeURIComponent("../../../secret")
            const { req, url } = createRequest("GET", `/api/runs/${runId}/questions/${maliciousId}`)
            const res = await handleRunsRoutes(req, url)
            expect(res).not.toBeNull()
            expect(res?.status).toBe(400) // Expect 400 Bad Request due to validation failure
            const data = await res?.json()
            expect(data.error).toBe("Invalid questionId")
        })

        test("should return 404 for non-existent run", async () => {
            const { req, url } = createRequest("GET", `/api/runs/non-existent/questions/${questionId}`)
            const res = await handleRunsRoutes(req, url)
            expect(res?.status).toBe(404)
        })

        test("should return 404 for non-existent question", async () => {
            const { req, url } = createRequest("GET", `/api/runs/${runId}/questions/non-existent`)
            const res = await handleRunsRoutes(req, url)
            expect(res?.status).toBe(404)
        })
    })

    describe("POST /api/runs/start", () => {
        test("should validate request body", async () => {
            const { req, url } = createRequest("POST", "/api/runs/start", {
                // Missing required fields
                provider: "supermemory"
            })
            const res = await handleRunsRoutes(req, url)
            expect(res?.status).toBe(400)
        })

        test("should reject invalid runId", async () => {
            const { req, url } = createRequest("POST", "/api/runs/start", {
                provider: "supermemory",
                benchmark: "locomo",
                judgeModel: "gpt-4o",
                runId: "invalid/run/id" // Contains invalid char
            })
            const res = await handleRunsRoutes(req, url)
            expect(res?.status).toBe(400)
        })
    })
})
