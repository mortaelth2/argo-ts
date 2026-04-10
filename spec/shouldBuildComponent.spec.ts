import { ComponentFilter } from "../src/bootstrap";

describe("shouldBuildComponent", () => {
    describe("ComponentFilter.shouldInclude", () => {
        it("should include all components when no filter is set", () => {
            expect(ComponentFilter.shouldInclude("core/commonBuilder/observability")).toBe(true);
            expect(ComponentFilter.shouldInclude("core/commonBuilder/observability", undefined)).toBe(true);
            expect(ComponentFilter.shouldInclude("core/commonBuilder/observability", "")).toBe(true);
            expect(ComponentFilter.shouldInclude("core/commonBuilder/observability", "  ")).toBe(true);
        });

        it("should include on exact match", () => {
            expect(ComponentFilter.shouldInclude("core/commonBuilder", "core/commonBuilder")).toBe(true);
        });

        it("should include when component is a parent of the filter", () => {
            expect(ComponentFilter.shouldInclude("core/commonBuilder", "core/commonBuilder/observability")).toBe(true);
            expect(ComponentFilter.shouldInclude("core", "core/commonBuilder/observability")).toBe(true);
        });

        it("should exclude when component is a child of the filter", () => {
            expect(ComponentFilter.shouldInclude("core/commonBuilder/observability", "core/commonBuilder")).toBe(false);
            expect(ComponentFilter.shouldInclude("core/commonBuilder/observability", "core")).toBe(false);
        });

        it("should exclude when paths are unrelated", () => {
            expect(ComponentFilter.shouldInclude("core/otherBuilder", "core/commonBuilder")).toBe(false);
            expect(ComponentFilter.shouldInclude("apps/myApp", "core/commonBuilder")).toBe(false);
        });

        it("should not match partial path segments", () => {
            // "core/common" should NOT match filter "core/commonBuilder"
            expect(ComponentFilter.shouldInclude("core/common", "core/commonBuilder")).toBe(false);
        });

        it("should handle trimming of the filter", () => {
            expect(ComponentFilter.shouldInclude("core/commonBuilder", "  core/commonBuilder  ")).toBe(true);
        });
    });
});
