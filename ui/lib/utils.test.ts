import { describe, expect, test } from "bun:test"
import { cn, formatDate, formatDuration, getStatusColor, calculateAccuracy } from "./utils"

describe("UI Utils", () => {
    describe("cn", () => {
        test("should merge class names", () => {
            expect(cn("foo", "bar")).toBe("foo bar")
        })

        test("should filter falsy values", () => {
            expect(cn("foo", false, "bar", null, undefined)).toBe("foo bar")
        })
    })

    describe("formatDuration", () => {
        test("should format milliseconds", () => {
            expect(formatDuration(500)).toBe("500ms")
        })

        test("should format seconds", () => {
            expect(formatDuration(1500)).toBe("1.5s")
        })

        test("should format minutes", () => {
            expect(formatDuration(65000)).toBe("1.1m")
        })
    })

    describe("getStatusColor", () => {
        test("should return correct badge class for status", () => {
            expect(getStatusColor("completed")).toBe("badge-success")
            expect(getStatusColor("failed")).toBe("badge-error")
            expect(getStatusColor("running")).toBe("badge-running")
            expect(getStatusColor("unknown")).toBe("badge-neutral")
        })
    })

    describe("calculateAccuracy", () => {
        test("should calculate percentage of correct answers", () => {
            const summary: any = { total: 2, evaluated: 2 }
            const questions = {
                q1: { phases: { evaluate: { status: "completed", score: 1 } } },
                q2: { phases: { evaluate: { status: "completed", score: 0 } } }
            }
            expect(calculateAccuracy(summary, questions)).toBe(50)
        })

        test("should return null if no questions evaluated", () => {
            const summary: any = { total: 0, evaluated: 0 }
            expect(calculateAccuracy(summary, {})).toBeNull()
        })
    })

    describe("formatDate", () => {
        test("should format 'just now'", () => {
            const now = new Date().toISOString()
            expect(formatDate(now)).toBe("just now")
        })

        // Note: Testing precise date logic relative to "now" is flaky without mocking Date.
        // For simple utilities, checking basic execution is often sufficient or usage of a library like 'date-fns' makes it easier.
        // Here we just test the "just now" case as a smoke test.
    })
})
