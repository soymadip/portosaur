import { describe, test, expect } from "bun:test";
import {
  bioParagraphs,
  isAboutVisible,
  isContactVisible,
  isExperienceVisible,
  isProjectsVisible,
  isResumeFile,
  learnMoreTarget,
  maxScrollerIndex,
  projectAutoplaySeconds,
  socialIconColor,
  sortEmailFirst,
  visibleProjectCount,
  visibleSectionIds,
} from "../src/lib/portfolio-home.ts";

/**
 * The portfolio home's pure logic: section visibility, the
 * project scroller's counts, the email-first contact order, and
 * the icon colors. The page and the sections share these, so a
 * visibility change in one place can never strand the "Learn
 * More" jump or the floating arrow.
 */

describe("bioParagraphs", () => {
  test("a list passes through", () => {
    expect(bioParagraphs(["one", "two"])).toEqual(["one", "two"]);
  });

  test("a lone string becomes one paragraph", () => {
    expect(bioParagraphs("hello")).toEqual(["hello"]);
  });

  test("anything else is empty", () => {
    expect(bioParagraphs("")).toEqual([]);
    expect(bioParagraphs(undefined)).toEqual([]);
    expect(bioParagraphs(["one", 42, null])).toEqual(["one"]);
  });
});

describe("isResumeFile", () => {
  test("a file path counts", () => {
    expect(isResumeFile("resume.pdf")).toBe(true);
    expect(isResumeFile("https://example.com/cv.pdf")).toBe(true);
  });

  test('"none" and blanks do not', () => {
    expect(isResumeFile("none")).toBe(false);
    expect(isResumeFile(" None ")).toBe(false);
    expect(isResumeFile("")).toBe(false);
    expect(isResumeFile(undefined)).toBe(false);
  });
});

describe("section visibility", () => {
  test("about needs content besides the photo", () => {
    expect(isAboutVisible({ enable: true, bio: ["hi"] })).toBe(true);
    expect(isAboutVisible({ enable: true, skills: ["ts"] })).toBe(true);
    expect(isAboutVisible({ enable: true, resume: "cv.pdf" })).toBe(true);
    expect(isAboutVisible({ enable: true })).toBe(false);
    expect(isAboutVisible({ enable: true, bio: [] })).toBe(false);
    expect(isAboutVisible({ enable: false, bio: ["hi"] })).toBe(false);
  });

  test("projects needs at least one project", () => {
    expect(isProjectsVisible({ enable: true, projects: [{}] })).toBe(true);
    expect(isProjectsVisible({ enable: true, projects: [] })).toBe(false);
    expect(isProjectsVisible({ enable: false, projects: [{}] })).toBe(false);
  });

  test("experience defaults off", () => {
    expect(isExperienceVisible({ enable: true, list: [{}] })).toBe(true);
    expect(isExperienceVisible({ enable: false, list: [{}] })).toBe(false);
    expect(isExperienceVisible({ list: [{}] })).toBe(false);
    expect(isExperienceVisible({ enable: true, list: [] })).toBe(false);
  });

  test("contact needs at least one link", () => {
    expect(isContactVisible({ enable: true, links: [{}] })).toBe(true);
    expect(isContactVisible({ enable: true, links: [] })).toBe(false);
    expect(isContactVisible({ enable: false, links: [{}] })).toBe(false);
  });
});

describe("learnMoreTarget", () => {
  const none = {
    about: false,
    projects: false,
    experience: false,
    contact: false,
  };

  test("the first visible section below the hero", () => {
    expect(learnMoreTarget({ ...none, about: true })).toBe("about");
    expect(learnMoreTarget({ ...none, projects: true })).toBe("projects");
    expect(learnMoreTarget({ ...none, experience: true })).toBe("experience");
    expect(learnMoreTarget({ ...none, contact: true })).toBe("contact");
    expect(
      learnMoreTarget({
        about: false,
        projects: true,
        experience: true,
        contact: true,
      }),
    ).toBe("projects");
  });

  test("null when nothing below the hero renders", () => {
    expect(learnMoreTarget(none)).toBeNull();
  });
});

describe("visibleSectionIds", () => {
  test("the hero plus every visible section, in order", () => {
    expect(
      visibleSectionIds({
        about: true,
        projects: false,
        experience: true,
        contact: true,
      }),
    ).toEqual(["me", "about", "experience", "contact"]);
    expect(
      visibleSectionIds({
        about: false,
        projects: false,
        experience: false,
        contact: false,
      }),
    ).toEqual(["me"]);
  });
});

describe("visibleProjectCount", () => {
  test("one on a phone, two on a tablet, three on desktop", () => {
    expect(visibleProjectCount(390)).toBe(1);
    expect(visibleProjectCount(600)).toBe(1);
    expect(visibleProjectCount(601)).toBe(2);
    expect(visibleProjectCount(1024)).toBe(2);
    expect(visibleProjectCount(1025)).toBe(3);
    expect(visibleProjectCount(1920)).toBe(3);
  });
});

describe("maxScrollerIndex", () => {
  test("the last position puts the final card at the row's end", () => {
    expect(maxScrollerIndex(7, 3)).toBe(4);
    expect(maxScrollerIndex(3, 3)).toBe(0);
    expect(maxScrollerIndex(2, 3)).toBe(0);
    expect(maxScrollerIndex(0, 3)).toBe(0);
  });
});

describe("projectAutoplaySeconds", () => {
  test("true means 5 seconds", () => {
    expect(projectAutoplaySeconds(true)).toBe(5);
  });

  test("anything else means off", () => {
    expect(projectAutoplaySeconds(false)).toBe(0);
    expect(projectAutoplaySeconds(undefined)).toBe(0);
    expect(projectAutoplaySeconds("yes")).toBe(0);
  });
});

describe("sortEmailFirst", () => {
  test("email links move to the front, the rest keep order", () => {
    const links = [
      { name: "GitHub", url: "https://github.com/x" },
      { name: "Email", url: "mailto:a@b.c" },
      { name: "Telegram", url: "https://t.me/x" },
      { name: "Mail", icon: "email-icon", url: "https://example.com" },
    ];
    expect(sortEmailFirst(links).map((link) => link.name)).toEqual([
      "Email",
      "Mail",
      "GitHub",
      "Telegram",
    ]);
  });

  test("the input list is not mutated", () => {
    const links = [
      { name: "GitHub", url: "https://github.com/x" },
      { name: "Email", url: "mailto:a@b.c" },
    ];
    sortEmailFirst(links);
    expect(links[0].name).toBe("GitHub");
  });
});

describe("socialIconColor", () => {
  test("the link's own color wins", () => {
    expect(socialIconColor({ color: "#123456", name: "GitHub" })).toBe(
      "#123456",
    );
  });

  test("then the icon map's brand color for the site name", () => {
    expect(socialIconColor({ name: "GitHub" })).toBe("#333333");
  });

  test("unknown names get nothing", () => {
    expect(socialIconColor({ name: "MySpace Page" })).toBeUndefined();
    expect(socialIconColor({})).toBeUndefined();
  });
});
