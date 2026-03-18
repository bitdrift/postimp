import { describe, it, expect, vi, beforeEach } from "vitest";
import { orchestrateArticle } from "@/lib/slack/orchestrate-article";
import { reviseArticle } from "@/lib/core/article-tools";
import { postSlackMessage } from "@/lib/slack/client";
import { updateThreadResponseId } from "@/lib/db/articles";

vi.mock("@/lib/core/article-tools", () => ({
  reviseArticle: vi.fn(),
}));

vi.mock("@/lib/slack/client", () => ({
  postSlackMessage: vi.fn(),
}));

vi.mock("@/lib/db/articles", () => ({
  updateThreadResponseId: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({
  createDbClient: vi.fn().mockReturnValue({}),
}));

const mockRevise = vi.mocked(reviseArticle);
const mockSlack = vi.mocked(postSlackMessage);
const mockUpdateThread = vi.mocked(updateThreadResponseId);

const baseParams = {
  articleId: "art_1",
  threadId: "thread_1",
  text: "make it shorter",
  previousResponseId: "resp_prev",
  channel: "C123",
  threadTs: "1234567890.123456",
};

describe("orchestrateArticle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("posts AI error to Slack when reviseArticle throws", async () => {
    mockRevise.mockRejectedValueOnce(new Error("AI broke"));

    const result = await orchestrateArticle(baseParams);

    expect(result).toEqual({ published: false });
    expect(mockSlack).toHaveBeenCalledOnce();
    expect(mockSlack).toHaveBeenCalledWith(
      "C123",
      "Something went wrong talking to AI. Please try again.",
      baseParams.threadTs,
    );
  });

  it("posts specific error when updateThreadResponseId fails", async () => {
    mockRevise.mockResolvedValueOnce({
      responseId: "resp_new",
      textResponse: "Updated!",
      published: false,
      updatedFields: null,
    });
    mockUpdateThread.mockRejectedValueOnce(new Error("DB error"));

    const result = await orchestrateArticle(baseParams);

    expect(result).toEqual({ published: false });
    // Should post the specific post-AI error, not the generic AI error
    expect(mockSlack).toHaveBeenCalledWith(
      "C123",
      expect.stringContaining("trouble saving the conversation state"),
      baseParams.threadTs,
    );
  });

  it("does not throw when post-AI error reply to Slack also fails", async () => {
    mockRevise.mockResolvedValueOnce({
      responseId: "resp_new",
      textResponse: "Updated!",
      published: false,
      updatedFields: null,
    });
    mockUpdateThread.mockRejectedValueOnce(new Error("DB error"));
    mockSlack.mockRejectedValueOnce(new Error("Slack is down"));

    const result = await orchestrateArticle(baseParams);

    expect(result).toEqual({ published: false });
  });

  it("posts AI text response on success", async () => {
    mockRevise.mockResolvedValueOnce({
      responseId: "resp_new",
      textResponse: "Here is the revised article.",
      published: false,
      updatedFields: null,
    });
    mockUpdateThread.mockResolvedValueOnce(undefined);

    const result = await orchestrateArticle(baseParams);

    expect(result).toEqual({ published: false });
    expect(mockSlack).toHaveBeenCalledWith(
      "C123",
      "Here is the revised article.",
      baseParams.threadTs,
    );
    expect(mockUpdateThread).toHaveBeenCalledWith({}, "thread_1", "resp_new");
  });

  it("skips posting when textResponse is empty", async () => {
    mockRevise.mockResolvedValueOnce({
      responseId: "resp_new",
      textResponse: "",
      published: false,
      updatedFields: null,
    });
    mockUpdateThread.mockResolvedValueOnce(undefined);

    await orchestrateArticle(baseParams);

    expect(mockSlack).not.toHaveBeenCalled();
  });
});
