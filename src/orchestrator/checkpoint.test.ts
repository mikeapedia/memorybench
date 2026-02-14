import { describe, expect, test, beforeEach, afterEach, mock, spyOn } from "bun:test"
import { CheckpointManager } from "./checkpoint"
import * as fs from "fs"
import { join } from "path"

describe("CheckpointManager", () => {
    let manager: CheckpointManager
    const TEST_RUN_ID = "test-run-123"
    const TEST_BASE_PATH = "./test-data/runs"

    // Spies
    let existsStub: any
    let writeStub: any
    let readStub: any
    let mkdirStub: any
    let rmStub: any
    let renameStub: any

    beforeEach(() => {
        manager = new CheckpointManager(TEST_BASE_PATH)

        // Spy on fs methods and prevent actual FS operations
        existsStub = spyOn(fs, "existsSync").mockImplementation(() => false)
        writeStub = spyOn(fs, "writeFileSync").mockImplementation(() => { })
        readStub = spyOn(fs, "readFileSync").mockImplementation(() => "" as any)
        mkdirStub = spyOn(fs, "mkdirSync").mockImplementation(() => undefined as any)
        rmStub = spyOn(fs, "rmSync").mockImplementation(() => { })
        renameStub = spyOn(fs, "renameSync").mockImplementation(() => { })
    })

    afterEach(() => {
        // Restore original implementations
        mock.restore()
    })

    test("should create a new run checkpoint", async () => {
        const checkpoint = manager.create(
            TEST_RUN_ID,
            "openai",
            "locomo",
            "gpt-4o",
            "gpt-4o"
        )

        // Wait for async save operation
        await manager.flush(TEST_RUN_ID)

        expect(checkpoint.runId).toBe(TEST_RUN_ID)
        expect(checkpoint.provider).toBe("openai")
        expect(checkpoint.status).toBe("initializing")
        expect(mkdirStub).toHaveBeenCalled()
        expect(writeStub).toHaveBeenCalled()
    })

    test("should load an existing checkpoint", () => {
        const mockData = JSON.stringify({
            runId: TEST_RUN_ID,
            status: "running",
            questions: {}
        })

        existsStub.mockImplementation(() => true)
        readStub.mockImplementation(() => mockData)

        const checkpoint = manager.load(TEST_RUN_ID)

        expect(checkpoint).not.toBeNull()
        expect(checkpoint?.runId).toBe(TEST_RUN_ID)
        expect(checkpoint?.status).toBe("running")
    })

    test("should return null if checkpoint does not exist", () => {
        existsStub.mockImplementation(() => false)
        const checkpoint = manager.load("non-existent")
        expect(checkpoint).toBeNull()
    })

    test("should update run status", async () => {
        const checkpoint: any = {
            runId: TEST_RUN_ID,
            status: "running",
            updatedAt: ""
        }

        manager.updateStatus(checkpoint, "completed")
        await manager.flush(TEST_RUN_ID)

        expect(checkpoint.status).toBe("completed")
        expect(writeStub).toHaveBeenCalled()
    })

    test("should initialize a question", () => {
        const checkpoint: any = {
            runId: TEST_RUN_ID,
            questions: {}
        }

        const qId = "q1"
        manager.initQuestion(checkpoint, qId, "tag1", {
            question: "Q?",
            groundTruth: "A",
            questionType: "fact"
        })

        expect(checkpoint.questions[qId]).toBeDefined()
        expect(checkpoint.questions[qId].phases.ingest.status).toBe("pending")
    })
})
