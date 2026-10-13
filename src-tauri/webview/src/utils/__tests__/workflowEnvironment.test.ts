import { describe, it, expect } from "vitest";
import { mergeWorkflowEnvironmentVariables } from "../bridge";

describe("mergeWorkflowEnvironmentVariables", () => {
    it("uses the environment's variables when the workflow defines none", () => {
        const merged = mergeWorkflowEnvironmentVariables(
            { endpoint_url: "https://api.example.com", clientId: "C-9" },
            {},
        );
        expect(merged).toEqual({
            endpoint_url: "https://api.example.com",
            clientId: "C-9",
            url: "https://api.example.com",
            env: "https://api.example.com",
        });
    });

    it("gives workflow variables precedence on name clash (chained values win)", () => {
        const merged = mergeWorkflowEnvironmentVariables(
            { endpoint_url: "https://env.example.com", token: "env-token" },
            { token: "extracted-token" },
        );
        expect(merged.token).toBe("extracted-token");
        // Unclashed environment keys are still available for substitution.
        expect(merged.endpoint_url).toBe("https://env.example.com");
        expect(merged.url).toBe("https://env.example.com");
    });

    it("maps url/env to the environment's endpoint_url, overriding the env's own label key", () => {
        // Default environments carry an `env` key holding the env label
        // (e.g. "sit01") — the shortcut must win, matching the single-request
        // WildcardProcessor semantics ({{url}}/{{env}} → endpoint URL).
        const merged = mergeWorkflowEnvironmentVariables(
            { endpoint_url: "https://sit.example.com", env: "sit01", color: "#7EE787" },
            {},
        );
        expect(merged.url).toBe("https://sit.example.com");
        expect(merged.env).toBe("https://sit.example.com");
        expect(merged.color).toBe("#7EE787");
    });

    it("lets an explicit workflow url/env variable win over the shortcut", () => {
        // A wizard manual variable or extractor named `env` was created
        // deliberately by the user — its value must not be silently replaced
        // by the endpoint URL.
        const merged = mergeWorkflowEnvironmentVariables(
            { endpoint_url: "https://api.example.com", env: "sit01" },
            { env: "CIT" },
        );
        expect(merged.env).toBe("CIT");
        expect(merged.url).toBe("https://api.example.com");
    });

    it("returns the workflow variables untouched when no environment is active", () => {
        const merged = mergeWorkflowEnvironmentVariables({}, { a: "1", b: "2" });
        expect(merged).toEqual({ a: "1", b: "2" });
    });

    it("tolerates null/undefined workflow variables", () => {
        expect(mergeWorkflowEnvironmentVariables({ x: "y" }, undefined)).toEqual({ x: "y" });
        expect(mergeWorkflowEnvironmentVariables({ x: "y" }, null)).toEqual({ x: "y" });
    });
});
