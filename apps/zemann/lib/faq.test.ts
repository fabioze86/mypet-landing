import { describe, expect, it } from "vitest";
import { GENERAL_FAQ } from "./faq";

describe("GENERAL_FAQ", () => {
  it("tem perguntas únicas terminadas em interrogação e respostas preenchidas", () => {
    const questions = GENERAL_FAQ.map((item) => item.q);
    expect(new Set(questions).size).toBe(questions.length);
    for (const item of GENERAL_FAQ) {
      expect(item.q.endsWith("?")).toBe(true);
      expect(item.a.length).toBeGreaterThan(40);
    }
  });
});
