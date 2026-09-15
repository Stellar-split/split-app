import { describe, it, expect } from "vitest";
import { formatRelative, getRelativeAge } from "@/lib/dateUtils";

describe("dateUtils", () => {
  const baseNow = new Date("2026-09-15T12:00:00.000Z");

  describe("formatRelative", () => {
    it("returns 'just now' for dates within 60 seconds of now in the past", () => {
      const dateJustNow = new Date(baseNow.getTime() - 30 * 1000);
      expect(formatRelative(dateJustNow, baseNow)).toBe("just now");
      expect(formatRelative(baseNow, baseNow)).toBe("just now");
    });

    it("returns 'just now' for dates within 60 seconds of now in the future", () => {
      const dateFutureSeconds = new Date(baseNow.getTime() + 45 * 1000);
      expect(formatRelative(dateFutureSeconds, baseNow)).toBe("just now");
    });

    it("formats minutes ago correctly (singular and plural)", () => {
      const oneMinuteAgo = new Date(baseNow.getTime() - 60 * 1000);
      expect(formatRelative(oneMinuteAgo, baseNow)).toBe("1 minute ago");

      const twoMinutesAgo = new Date(baseNow.getTime() - 2 * 60 * 1000);
      expect(formatRelative(twoMinutesAgo, baseNow)).toBe("2 minutes ago");

      const fiftyNineMinutesAgo = new Date(baseNow.getTime() - 59 * 60 * 1000);
      expect(formatRelative(fiftyNineMinutesAgo, baseNow)).toBe("59 minutes ago");
    });

    it("formats future minutes correctly", () => {
      const inOneMinute = new Date(baseNow.getTime() + 61 * 1000);
      expect(formatRelative(inOneMinute, baseNow)).toBe("in 1 minute");

      const inFiveMinutes = new Date(baseNow.getTime() + 5 * 60 * 1000);
      expect(formatRelative(inFiveMinutes, baseNow)).toBe("in 5 minutes");
    });

    it("formats hours ago correctly (singular and plural)", () => {
      const oneHourAgo = new Date(baseNow.getTime() - 60 * 60 * 1000);
      expect(formatRelative(oneHourAgo, baseNow)).toBe("1 hour ago");

      const fiveHoursAgo = new Date(baseNow.getTime() - 5 * 60 * 60 * 1000);
      expect(formatRelative(fiveHoursAgo, baseNow)).toBe("5 hours ago");
    });

    it("formats future hours correctly", () => {
      const inOneHour = new Date(baseNow.getTime() + 60 * 60 * 1000);
      expect(formatRelative(inOneHour, baseNow)).toBe("in 1 hour");

      const inFiveHours = new Date(baseNow.getTime() + 5 * 60 * 60 * 1000);
      expect(formatRelative(inFiveHours, baseNow)).toBe("in 5 hours");
    });

    it("formats days ago correctly (singular and plural)", () => {
      const oneDayAgo = new Date(baseNow.getTime() - 24 * 60 * 60 * 1000);
      expect(formatRelative(oneDayAgo, baseNow)).toBe("1 day ago");

      const threeDaysAgo = new Date(baseNow.getTime() - 3 * 24 * 60 * 60 * 1000);
      expect(formatRelative(threeDaysAgo, baseNow)).toBe("3 days ago");
    });

    it("formats future days correctly", () => {
      const inOneDay = new Date(baseNow.getTime() + 24 * 60 * 60 * 1000);
      expect(formatRelative(inOneDay, baseNow)).toBe("in 1 day");

      const inThreeDays = new Date(baseNow.getTime() + 3 * 24 * 60 * 60 * 1000);
      expect(formatRelative(inThreeDays, baseNow)).toBe("in 3 days");
    });

    it("formats weeks ago correctly (singular and plural)", () => {
      const oneWeekAgo = new Date(baseNow.getTime() - 7 * 24 * 60 * 60 * 1000);
      expect(formatRelative(oneWeekAgo, baseNow)).toBe("1 week ago");

      const threeWeeksAgo = new Date(baseNow.getTime() - 21 * 24 * 60 * 60 * 1000);
      expect(formatRelative(threeWeeksAgo, baseNow)).toBe("3 weeks ago");
    });

    it("formats future weeks correctly", () => {
      const inOneWeek = new Date(baseNow.getTime() + 7 * 24 * 60 * 60 * 1000);
      expect(formatRelative(inOneWeek, baseNow)).toBe("in 1 week");

      const inTwoWeeks = new Date(baseNow.getTime() + 14 * 24 * 60 * 60 * 1000);
      expect(formatRelative(inTwoWeeks, baseNow)).toBe("in 2 weeks");
    });

    it("formats months ago correctly (singular and plural)", () => {
      const oneMonthAgo = new Date(baseNow.getTime() - 30 * 24 * 60 * 60 * 1000);
      expect(formatRelative(oneMonthAgo, baseNow)).toBe("1 month ago");

      const threeMonthsAgo = new Date(baseNow.getTime() - 90 * 24 * 60 * 60 * 1000);
      expect(formatRelative(threeMonthsAgo, baseNow)).toBe("3 months ago");
    });

    it("formats future months correctly", () => {
      const inOneMonth = new Date(baseNow.getTime() + 30 * 24 * 60 * 60 * 1000);
      expect(formatRelative(inOneMonth, baseNow)).toBe("in 1 month");

      const inTwoMonths = new Date(baseNow.getTime() + 60 * 24 * 60 * 60 * 1000);
      expect(formatRelative(inTwoMonths, baseNow)).toBe("in 2 months");
    });

    it("caps distant dates over a year ago or over a year from now", () => {
      const twoYearsAgo = new Date(baseNow.getTime() - 400 * 24 * 60 * 60 * 1000);
      expect(formatRelative(twoYearsAgo, baseNow)).toBe("over a year ago");

      const twoYearsFuture = new Date(baseNow.getTime() + 400 * 24 * 60 * 60 * 1000);
      expect(formatRelative(twoYearsFuture, baseNow)).toBe("over a year from now");
    });

    it("defaults now to current date if omitted", () => {
      const recent = new Date();
      expect(formatRelative(recent)).toBe("just now");
    });

    it("returns empty string on invalid dates", () => {
      expect(formatRelative(new Date("invalid date"), baseNow)).toBe("");
    });
  });

  describe("getRelativeAge", () => {
    it("handles recent dates gracefully", () => {
      const recent = new Date();
      expect(getRelativeAge(recent)).toBe("just now");
    });
  });
});
